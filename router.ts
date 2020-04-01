/**
 * Adapted directly from koa-router at
 * https://github.com/alexmingoia/koa-router/ which is licensed as:
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Alexander C. Mingoia
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import httpError from "./httpError.ts";
import { Middleware, compose } from "./middleware.ts";
import { Key, pathToRegExp } from "./pathToRegExp.ts";
import { HTTPMethods } from "./types.ts";
import { decodeComponent } from "./util.ts";

const { MethodNotAllowed, NotImplemented } = httpError;

interface AllowedMethodsOptions {
  /** A method to be called in lieu of throwing a `MethodNotAllowed` HTTP
   * error. */
  methodNotAllowed?: () => any;

  /** A method to be called in lieu of throwing a `NotImplemented` HTTP
   * error */
  notImplemented?: () => any;
  throw?: boolean;
}

export interface RouteParams {
  [key: string]: string | undefined;
  [key: number]: string | undefined;
}

/** The context passed router middleware.  */
export interface RouterContext<
  P extends RouteParams = RouteParams,
  S extends {} = { [key: string]: any; }
> extends Context<S> {
  /** Any parameters parsed from the route when matched. */
  params: P;

  /** A reference to the router instance. */
  router: Router<S>;
}

export interface RouterMiddleware<
  P extends RouteParams = RouteParams,
  S extends {} = { [key: string]: any }
> {
  (context: RouterContext<P, S>, next: () => Promise<void>): Promise<
    void
  > | void;
}

export interface RouterOptions {
  /** The part of the path that should prefix all the routes for this
   * router. */
  prefix?: string;

  /** The set of HTTP methods that this router can service. */
  methods?: HTTPMethods[];

  /** Determines if routes are matched in a case sensitive way.  Defaults to
   * `false`.
   */
  sensitive?: boolean;

  /** Determines if routes are matched strictly, where the trailing `/` is not
   * optional.  Defaults to `false`.
   */
  strict?: boolean;
}

interface LayerOptions {
  ignoreCaptures?: boolean;
  name?: string;
  sensitive?: boolean;
  strict?: boolean;
}

class Layer<P extends RouteParams = RouteParams, S extends {} = { [key: string]: any; }> {
  name: string | null;
  paramNames: Key[] = [];
  regexp: RegExp;
  stack: RouterMiddleware<P, S>[];

  constructor(
    public path: string,
    public methods: HTTPMethods[],
    middleware: RouterMiddleware<P, S> | RouterMiddleware<P, S>[],
    public options: LayerOptions = {}
  ) {
    this.name = options.name || null;
    this.stack = Array.isArray(middleware) ? middleware : [middleware];
    if (this.methods.includes("GET")) {
      this.methods.unshift("HEAD");
    }
    this.regexp = pathToRegExp(path, this.paramNames, options);
  }

  matches(path: string): boolean {
    return this.regexp.test(path);
  }

  params(captures: string[], existingParams: RouteParams = {}): RouteParams {
    const params = existingParams;
    for (let i = 0; i < captures.length; i++) {
      if (this.paramNames[i]) {
        const capture = captures[i];
        params[this.paramNames[i].name] = capture
          ? decodeComponent(capture)
          : capture;
      }
    }
    return params;
  }

  captures(path: string): string[] {
    if (this.options.ignoreCaptures) {
      return [];
    }
    const [, ...captures] = path.match(this.regexp)!;
    return captures;
  }

  setPrefix(prefix: string): this {
    if (this.path) {
      this.path = `${prefix}${this.path}`;
      this.paramNames = [];
      this.regexp = pathToRegExp(this.path, this.paramNames, this.options);
    }
    return this;
  }
}

/** A class that routes requests to middleware based on the method and the
 * path name of the request.
 */
export class Router<S extends {} = { [key: string]: any; }> {
  private _methods: HTTPMethods[];
  private _stack: Layer<RouteParams, S>[] = [];
  private _prefix = "";
  private _contextRouteMatches = new WeakMap<RouterContext<RouteParams, S>, Layer<RouteParams, S>[]>();

  private _addRoute<P extends RouteParams = RouteParams>(
    path: string | string[],
    middleware: RouterMiddleware<P, S>[],
    ...methods: HTTPMethods[]
  ): this {
    if (Array.isArray(path)) {
      for (const r of path) {
        this._addRoute(r, middleware, ...methods);
      }
      return this;
    }
    const layer = new Layer<P, S>(path, methods, middleware);
    layer.setPrefix(this._prefix);
    this._stack.push(layer);
    return this;
  }

  private _match(
    path: string,
    method: HTTPMethods
  ): { routesMatched: Layer<RouteParams, S>[]; matches: Layer<RouteParams, S>[] } {
    const routesMatched: Layer<RouteParams, S>[] = [];
    const matches: Layer<RouteParams, S>[] = [];
    for (const layer of this._stack) {
      if (layer.matches(path)) {
        routesMatched.push(layer);
        if (layer.methods.includes(method)) {
          matches.push(layer);
        }
      }
    }
    return { routesMatched, matches };
  }

  constructor(options: RouterOptions = {}) {
    this._methods = options.methods || [
      "DELETE",
      "GET",
      "HEAD",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT",
    ];
    if (options.prefix) this._prefix = options.prefix;
  }

  /** Register middleware for the specified routes and the `DELETE`, `GET`,
   * `POST`, or `PUT` method is requested
   */
  all<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(
      route,
      middleware,
      "DELETE",
      "GET",
      "POST",
      "PUT",
    );
  }

  /** Middleware that automatically handles dealing with responding with
   * allowed methods for the defined routes.
   */
  allowedMethods(options: AllowedMethodsOptions = {}): Middleware {
    const contextRouteMatches = this._contextRouteMatches;
    const implemented = this._methods;
    return async function allowedMethods(context, next) {
      await next();
      const allowed = new Set<HTTPMethods>();
      if (
        !context.response.status ||
        context.response.status === Status.NotFound
      ) {
        const contextRoutesMatched = contextRouteMatches.get(
          context as RouterContext<RouteParams, S>
        );
        if (contextRoutesMatched) {
          for (const layer of contextRoutesMatched) {
            for (const method of layer.methods) {
              allowed.add(method);
            }
          }
        }
        const allowedValue = Array.from(allowed).join(", ");
        if (!implemented.includes(context.request.method)) {
          if (options.throw) {
            let notImplementedThrowable: any;
            if (typeof options.notImplemented === "function") {
              notImplementedThrowable = options.notImplemented();
            } else {
              notImplementedThrowable = new NotImplemented();
            }
            throw notImplementedThrowable;
          } else {
            context.response.status = Status.NotImplemented;
            context.response.headers.set("Allow", allowedValue);
          }
        } else if (allowed.size) {
          if (context.request.method === "OPTIONS") {
            context.response.status = Status.OK;
            context.response.body = "";
            context.response.headers.set("Allow", allowedValue);
          } else if (!allowed.has(context.request.method)) {
            if (options.throw) {
              let notAllowedThrowable: any;
              if (typeof options.methodNotAllowed === "function") {
                notAllowedThrowable = options.methodNotAllowed();
              } else {
                notAllowedThrowable = new MethodNotAllowed();
              }
              throw notAllowedThrowable;
            } else {
              context.response.status = Status.MethodNotAllowed;
              context.response.headers.set("Allow", allowedValue);
            }
          }
        }
      }
    };
  }

  /** Register middleware for the specified routes when the `DELETE` method is
   * requested.
   */
  delete<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(route, middleware, "DELETE");
  }

  /** Register middleware for the specified routes when the `GET` method is
   * requested.
   */
  get<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(route, middleware, "GET");
  }

  /** Register middleware for the specified routes when the `HEAD` method is
   * requested.
   */
  head<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(route, middleware, "HEAD");
  }

  /** Register middleware for the specified routes when the `OPTIONS` method is
   * requested.
   */
  options<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(route, middleware, "OPTIONS");
  }

  /** Register middleware for the specified routes when the `PATCH` method is
   * requested.
   */
  patch<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(route, middleware, "PATCH");
  }

  /** Register middleware for the specified routes when the `POST` method is
   * requested.
   */
  post<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(route, middleware, "POST");
  }

  /** Register middleware for the specified routes when the `PUT` method is
   * requested.
   */
  put<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P, S>[]
  ): this {
    return this._addRoute(route, middleware, "PUT");
  }

  /** Return middleware that represents all the currently registered routes. */
  routes(): Middleware<S> {
    const dispatch = async (
      context: RouterContext<RouteParams, S>,
      next: () => Promise<void>
    ): Promise<void> => {
      const { path, method } = context.request;
      const { routesMatched, matches } = this._match(path, method);

      const contextRoutesMatched = this._contextRouteMatches.get(context);
      this._contextRouteMatches.set(
        context,
        contextRoutesMatched
          ? [...contextRoutesMatched, ...routesMatched]
          : routesMatched,
      );

      context.router = this;

      if (!matches.length) {
        return next();
      }

      const chain = matches.reduce((prev, layer) => {
        prev.push((context: RouterContext<RouteParams, S>, next: () => Promise<void>) => {
          const captures = layer.captures(path);
          context.params = layer.params(captures, context.params);
          return next();
        });
        return [...prev, ...layer.stack];
      }, [] as RouterMiddleware<RouteParams, S>[]);
      return compose(chain)(context);
    };
    return dispatch as Middleware;
  }
}
