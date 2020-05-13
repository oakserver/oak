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
import { httpErrors } from "./httpError.ts";
import { Middleware, compose } from "./middleware.ts";
import { Key, pathToRegExp } from "./pathToRegExp.ts";
import { HTTPMethods } from "./types.ts";
import { decodeComponent } from "./util.ts";

const { MethodNotAllowed, NotImplemented } = httpErrors;

interface AllowedMethodsOptions {
  /** A method to be called in lieu of throwing a `MethodNotAllowed` HTTP
   * error. */
  methodNotAllowed?: () => any;

  /** A method to be called in lieu of throwing a `NotImplemented` HTTP
   * error */
  notImplemented?: () => any;
  throw?: boolean;
}

export type RouteParams = Record<string | number, string | undefined>;

export interface Route {
  path: string;
  methods: HTTPMethods[];
  middleware: RouterMiddleware[];
  options?: RouterOptions;
}

/** The context passed router middleware.  */
export interface RouterContext<
  P extends RouteParams = RouteParams,
  S extends Record<string | number | symbol, any> = Record<string, any>,
> extends Context<S> {
  /** Any parameters parsed from the route when matched. */
  params: P;

  /** A reference to the router instance. */
  router: Router;
}

export interface RouterMiddleware<
  P extends RouteParams = RouteParams,
  S extends Record<string | number | symbol, any> = Record<string, any>,
> {
  (context: RouterContext<P, S>, next: () => Promise<void>):
    | Promise<
      void
    >
    | void;
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

class Layer {
  name: string | null;
  paramNames: Key[] = [];
  regexp: RegExp;
  stack: RouterMiddleware[];

  constructor(
    public path: string,
    public methods: HTTPMethods[],
    middleware: RouterMiddleware | RouterMiddleware[],
    public options: LayerOptions = {},
  ) {
    this.name = options.name ?? null;
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

function inspectLayer(layer: Layer): Route {
  const { path, methods, stack, options } = layer;
  return {
    path,
    methods: [...methods],
    middleware: [...stack],
    options: options ? { ...options } : undefined,
  };
}

const contextRouteMatches = new WeakMap<RouterContext, Layer[]>();

/** A class that routes requests to middleware based on the method and the
 * path name of the request.
 */
export class Router {
  #methods: HTTPMethods[];
  #prefix = "";
  #stack: Layer[] = [];
  #strict = false;

  #addRoute = (
    path: string | string[],
    middleware: RouterMiddleware[],
    ...methods: HTTPMethods[]
  ): this => {
    if (Array.isArray(path)) {
      for (const r of path) {
        this.#addRoute(r, middleware, ...methods);
      }
      return this;
    }
    const layer = new Layer(
      path,
      methods,
      middleware,
      { strict: this.#strict },
    );
    layer.setPrefix(this.#prefix);
    this.#stack.push(layer);
    return this;
  };

  #match = (
    path: string,
    method: HTTPMethods,
  ): { routesMatched: Layer[]; matches: Layer[] } => {
    const routesMatched: Layer[] = [];
    const matches: Layer[] = [];
    for (const layer of this.#stack) {
      if (layer.matches(path)) {
        routesMatched.push(layer);
        if (layer.methods.includes(method)) {
          matches.push(layer);
        }
      }
    }
    return { routesMatched, matches };
  };

  constructor(options: RouterOptions = {}) {
    this.#methods = options.methods || [
      "DELETE",
      "GET",
      "HEAD",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT",
    ];
    if (options.prefix) this.#prefix = options.prefix;
    if (options.strict) this.#strict = options.strict;
  }

  /** Register middleware for the specified routes and the `DELETE`, `GET`,
   * `POST`, or `PUT` method is requested
   */
  all<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(
      route,
      middleware as RouterMiddleware[],
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
    const implemented = this.#methods;
    return async function allowedMethods(context, next) {
      await next();
      const allowed = new Set<HTTPMethods>();
      if (
        !context.response.status ||
        context.response.status === Status.NotFound
      ) {
        const contextRoutesMatched = contextRouteMatches.get(
          context as RouterContext,
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
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(route, middleware as RouterMiddleware[], "DELETE");
  }

  /** Register middleware for the specified routes when the `GET` method is
   * requested.
   */
  get<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(route, middleware as RouterMiddleware[], "GET");
  }

  /** Register middleware for the specified routes when the `HEAD` method is
   * requested.
   */
  head<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(route, middleware as RouterMiddleware[], "HEAD");
  }

  /** Register middleware for the specified routes when the `OPTIONS` method is
   * requested.
   */
  options<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(route, middleware as RouterMiddleware[], "OPTIONS");
  }

  /** Register middleware for the specified routes when the `PATCH` method is
   * requested.
   */
  patch<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(route, middleware as RouterMiddleware[], "PATCH");
  }

  /** Register middleware for the specified routes when the `POST` method is
   * requested.
   */
  post<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(route, middleware as RouterMiddleware[], "POST");
  }

  /** Register middleware for the specified routes when the `PUT` method is
   * requested.
   */
  put<P extends RouteParams = RouteParams>(
    route: string | string[],
    ...middleware: RouterMiddleware<P>[]
  ): this {
    return this.#addRoute(route, middleware as RouterMiddleware[], "PUT");
  }

  /** Return middleware that represents all the currently registered routes. */
  routes(): Middleware {
    const dispatch = async (
      context: RouterContext,
      next: () => Promise<void>,
    ): Promise<void> => {
      const { url: { pathname }, method } = context.request;
      const { routesMatched, matches } = this.#match(pathname, method);

      const contextRoutesMatched = contextRouteMatches.get(context);
      contextRouteMatches.set(
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
        prev.push((context: RouterContext, next: () => Promise<void>) => {
          const captures = layer.captures(pathname);
          context.params = layer.params(captures, context.params);
          return next();
        });
        return [...prev, ...layer.stack];
      }, [] as RouterMiddleware[]);
      return compose(chain)(context as RouterContext);
    };
    return dispatch as Middleware;
  }

  // Iterator interfaces

  *entries(): IterableIterator<[Route, Route]> {
    for (const layer of this.#stack) {
      const value = inspectLayer(layer);
      yield [value, value];
    }
  }

  forEach(
    callback: (value1: Route, value2: Route, router: this) => void,
    thisArg: any = null,
  ): void {
    for (const layer of this.#stack) {
      const value = inspectLayer(layer);
      callback.call(thisArg, value, value, this);
    }
  }

  *keys(): IterableIterator<Route> {
    for (const layer of this.#stack) {
      yield inspectLayer(layer);
    }
  }

  *values(): IterableIterator<Route> {
    for (const layer of this.#stack) {
      yield inspectLayer(layer);
    }
  }

  *[Symbol.iterator](): IterableIterator<Route> {
    for (const layer of this.#stack) {
      yield inspectLayer(layer);
    }
  }
}
