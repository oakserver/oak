/**
 * Adapted directly from @koa/router at
 * https://github.com/koajs/router/ which is licensed as:
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

import type { State } from "./application.ts";
import type { Context } from "./context.ts";
import {
  compile,
  Key,
  ParseOptions,
  pathParse,
  pathToRegexp,
  Status,
  TokensToRegexpOptions,
} from "./deps.ts";
import { httpErrors } from "./httpError.ts";
import { compose, Middleware } from "./middleware.ts";
import type { HTTPMethods, RedirectStatus } from "./types.d.ts";
import { assert, decodeComponent } from "./util.ts";

interface Matches<R extends string> {
  path: Layer<R>[];
  pathAndMethod: Layer<R>[];
  route: boolean;
}

export interface RouterAllowedMethodsOptions {
  /** Use the value returned from this function instead of an HTTP error
   * `MethodNotAllowed`. */
  // deno-lint-ignore no-explicit-any
  methodNotAllowed?(): any;

  /** Use the value returned from this function instead of an HTTP error
   * `NotImplemented`. */
  // deno-lint-ignore no-explicit-any
  notImplemented?(): any;

  /** When dealing with a non-implemented method or a method not allowed, throw
   * an error instead of setting the status and header for the response. */
  throw?: boolean;
}

export interface Route<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  // deno-lint-ignore no-explicit-any
  S extends State = Record<string, any>,
> {
  /** The HTTP methods that this route handles. */
  methods: HTTPMethods[];

  /** The middleware that will be applied to this route. */
  middleware: RouterMiddleware<R, P, S>[];

  /** An optional name for the route. */
  name?: string;

  /** Options that were used to create the route. */
  options: LayerOptions;

  /** The parameters that are identified in the route that will be parsed out
   * on matched requests. */
  paramNames: (keyof P)[];

  /** The path that this route manages. */
  path: string;

  /** The regular expression used for matching and parsing parameters for the
   * route. */
  regexp: RegExp;
}

/** The context passed router middleware.  */
export interface RouterContext<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  // deno-lint-ignore no-explicit-any
  S extends State = Record<string, any>,
> extends Context<S> {
  /** When matching the route, an array of the capturing groups from the regular
   * expression. */
  captures: string[];

  /** The routes that were matched for this request. */
  matched?: Layer<R, P, S>[];

  /** Any parameters parsed from the route when matched. */
  params: P;

  /** A reference to the router instance. */
  router: Router;

  /** If the matched route has a `name`, the matched route name is provided
   * here. */
  routeName?: string;

  /** Overrides the matched path for future route middleware, when a
   * `routerPath` option is not defined on the `Router` options. */
  routerPath?: string;
}

export interface RouterMiddleware<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  // deno-lint-ignore no-explicit-any
  S extends State = Record<string, any>,
> {
  (context: RouterContext<R, P, S>, next: () => Promise<unknown>):
    | Promise<unknown>
    | unknown;
  /** For route parameter middleware, the `param` key for this parameter will
   * be set. */
  param?: keyof P;
  // deno-lint-ignore no-explicit-any
  router?: Router<any>;
}

export interface RouterOptions {
  /** Override the default set of methods supported by the router. */
  methods?: HTTPMethods[];

  /** Only handle routes where the requested path starts with the prefix. */
  prefix?: string;

  /** Override the `request.url.pathname` when matching middleware to run. */
  routerPath?: string;

  /** Determines if routes are matched in a case sensitive way.  Defaults to
   * `false`. */
  sensitive?: boolean;

  /** Determines if routes are matched strictly, where the trailing `/` is not
   * optional.  Defaults to `false`. */
  strict?: boolean;
}

/** Middleware that will be called by the router when handling a specific
 * parameter, which the middleware will be called when a request matches the
 * route parameter. */
export interface RouterParamMiddleware<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  // deno-lint-ignore no-explicit-any
  S extends State = Record<string, any>,
> {
  (
    param: string,
    context: RouterContext<R, P, S>,
    next: () => Promise<unknown>,
  ): Promise<unknown> | unknown;
  // deno-lint-ignore no-explicit-any
  router?: Router<any>;
}

interface ParamsDictionary {
  [key: string]: string;
}

type RemoveTail<S extends string, Tail extends string> = S extends
  `${infer P}${Tail}` ? P : S;

type GetRouteParams<S extends string> = RemoveTail<
  RemoveTail<RemoveTail<S, `/${string}`>, `-${string}`>,
  `.${string}`
>;

export type RouteParams<Route extends string> = string extends Route
  ? ParamsDictionary
  : Route extends `${string}(${string}` ? ParamsDictionary
  : Route extends `${string}:${infer Rest}` ? 
    & (
      GetRouteParams<Rest> extends never ? ParamsDictionary
        : GetRouteParams<Rest> extends `${infer ParamName}?`
          ? { [P in ParamName]?: string }
        : { [P in GetRouteParams<Rest>]: string }
    )
    & (Rest extends `${GetRouteParams<Rest>}${infer Next}` ? RouteParams<Next>
      : unknown)
  : Record<string | number, string | undefined>;

type LayerOptions = TokensToRegexpOptions & ParseOptions & {
  ignoreCaptures?: boolean;
  name?: string;
};

type RegisterOptions = LayerOptions & {
  ignorePrefix?: boolean;
};

type UrlOptions = TokensToRegexpOptions & ParseOptions & {
  /** When generating a URL from a route, add the query to the URL.  If an
   * object */
  query?: URLSearchParams | Record<string, string> | string;
};

/** Generate a URL from a string, potentially replace route params with
 * values. */
function toUrl<R extends string>(
  url: string,
  params = {} as RouteParams<R>,
  options?: UrlOptions,
) {
  const tokens = pathParse(url);
  let replace = {} as RouteParams<R>;

  if (tokens.some((token) => typeof token === "object")) {
    replace = params;
  } else {
    options = params;
  }

  const toPath = compile(url, options);
  const replaced = toPath(replace);

  if (options && options.query) {
    const url = new URL(replaced, "http://oak");
    if (typeof options.query === "string") {
      url.search = options.query;
    } else {
      url.search = String(
        options.query instanceof URLSearchParams
          ? options.query
          : new URLSearchParams(options.query),
      );
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return replaced;
}

class Layer<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  // deno-lint-ignore no-explicit-any
  S extends State = Record<string, any>,
> {
  #opts: LayerOptions;
  #paramNames: Key[] = [];
  #regexp: RegExp;

  methods: HTTPMethods[];
  name?: string;
  path: string;
  stack: RouterMiddleware<R, P, S>[];

  constructor(
    path: string,
    methods: HTTPMethods[],
    middleware: RouterMiddleware<R, P, S> | RouterMiddleware<R, P, S>[],
    { name, ...opts }: LayerOptions = {},
  ) {
    this.#opts = opts;
    this.name = name;
    this.methods = [...methods];
    if (this.methods.includes("GET")) {
      this.methods.unshift("HEAD");
    }
    this.stack = Array.isArray(middleware) ? middleware.slice() : [middleware];
    this.path = path;
    this.#regexp = pathToRegexp(path, this.#paramNames, this.#opts);
  }

  clone(): Layer<R, P, S> {
    return new Layer(
      this.path,
      this.methods,
      this.stack,
      { name: this.name, ...this.#opts },
    );
  }

  match(path: string): boolean {
    return this.#regexp.test(path);
  }

  params(
    captures: string[],
    existingParams = {} as RouteParams<R>,
  ): RouteParams<R> {
    const params = existingParams;
    for (let i = 0; i < captures.length; i++) {
      if (this.#paramNames[i]) {
        const c = captures[i];
        params[this.#paramNames[i].name] = c ? decodeComponent(c) : c;
      }
    }
    return params;
  }

  captures(path: string): string[] {
    if (this.#opts.ignoreCaptures) {
      return [];
    }
    return path.match(this.#regexp)?.slice(1) ?? [];
  }

  url(
    params = {} as RouteParams<R>,
    options?: UrlOptions,
  ): string {
    const url = this.path.replace(/\(\.\*\)/g, "");
    return toUrl(url, params, options);
  }

  param(
    param: string,
    // deno-lint-ignore no-explicit-any
    fn: RouterParamMiddleware<any, any, any>,
  ) {
    const stack = this.stack;
    const params = this.#paramNames;
    const middleware: RouterMiddleware<R> = function (
      this: Router,
      ctx,
      next,
    ): Promise<unknown> | unknown {
      const p = ctx.params[param];
      assert(p);
      return fn.call(this, p, ctx, next);
    };
    middleware.param = param;

    const names = params.map((p) => p.name);

    const x = names.indexOf(param);
    if (x >= 0) {
      for (let i = 0; i < stack.length; i++) {
        const fn = stack[i];
        if (!fn.param || names.indexOf(fn.param as (string | number)) > x) {
          stack.splice(i, 0, middleware);
          break;
        }
      }
    }
    return this;
  }

  setPrefix(prefix: string): this {
    if (this.path) {
      this.path = this.path !== "/" || this.#opts.strict === true
        ? `${prefix}${this.path}`
        : prefix;
      this.#paramNames = [];
      this.#regexp = pathToRegexp(this.path, this.#paramNames, this.#opts);
    }
    return this;
  }

  // deno-lint-ignore no-explicit-any
  toJSON(): Route<any, any, any> {
    return {
      methods: [...this.methods],
      middleware: [...this.stack],
      paramNames: this.#paramNames.map((key) => key.name),
      path: this.path,
      regexp: this.#regexp,
      options: { ...this.#opts },
    };
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    return `${this.constructor.name} ${
      inspect({
        methods: this.methods,
        middleware: this.stack,
        options: this.#opts,
        paramNames: this.#paramNames.map((key) => key.name),
        path: this.path,
        regexp: this.#regexp,
      })
    }`;
  }
}

/** An interface for registering middleware that will run when certain HTTP
 * methods and paths are requested, as well as provides a way to parameterize
 * parts of the requested path. */
export class Router<
  // deno-lint-ignore no-explicit-any
  RS extends State = Record<string, any>,
> {
  #opts: RouterOptions;
  #methods: HTTPMethods[];
  // deno-lint-ignore no-explicit-any
  #params: Record<string, RouterParamMiddleware<any, any, any>> = {};
  #stack: Layer<string>[] = [];

  #match(path: string, method: HTTPMethods): Matches<string> {
    const matches: Matches<string> = {
      path: [],
      pathAndMethod: [],
      route: false,
    };

    for (const route of this.#stack) {
      if (route.match(path)) {
        matches.path.push(route);
        if (route.methods.length === 0 || route.methods.includes(method)) {
          matches.pathAndMethod.push(route);
          if (route.methods.length) {
            matches.route = true;
          }
        }
      }
    }

    return matches;
  }

  #register(
    path: string | string[],
    middlewares: RouterMiddleware<string>[],
    methods: HTTPMethods[],
    options: RegisterOptions = {},
  ): void {
    if (Array.isArray(path)) {
      for (const p of path) {
        this.#register(p, middlewares, methods, options);
      }
      return;
    }

    let layerMiddlewares: RouterMiddleware<string>[] = [];
    for (const middleware of middlewares) {
      if (!middleware.router) {
        layerMiddlewares.push(middleware);
        continue;
      }

      if (layerMiddlewares.length) {
        this.#addLayer(path, layerMiddlewares, methods, options);
        layerMiddlewares = [];
      }

      const router = middleware.router.#clone();

      for (const layer of router.#stack) {
        if (!options.ignorePrefix) {
          layer.setPrefix(path);
        }
        if (this.#opts.prefix) {
          layer.setPrefix(this.#opts.prefix);
        }
        this.#stack.push(layer);
      }

      for (const [param, mw] of Object.entries(this.#params)) {
        router.param(param, mw);
      }
    }

    if (layerMiddlewares.length) {
      this.#addLayer(path, layerMiddlewares, methods, options);
    }
  }

  #addLayer(
    path: string,
    middlewares: RouterMiddleware<string>[],
    methods: HTTPMethods[],
    options: LayerOptions = {},
  ) {
    const {
      end,
      name,
      sensitive = this.#opts.sensitive,
      strict = this.#opts.strict,
      ignoreCaptures,
    } = options;
    const route = new Layer(path, methods, middlewares, {
      end,
      name,
      sensitive,
      strict,
      ignoreCaptures,
    });

    if (this.#opts.prefix) {
      route.setPrefix(this.#opts.prefix);
    }

    for (const [param, mw] of Object.entries(this.#params)) {
      route.param(param, mw);
    }

    this.#stack.push(route);
  }

  #route(name: string): Layer<string> | undefined {
    for (const route of this.#stack) {
      if (route.name === name) {
        return route;
      }
    }
  }

  #useVerb(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string>,
    middleware: RouterMiddleware<string>[],
    methods: HTTPMethods[],
  ): void {
    let name: string | undefined = undefined;
    let path: string;
    if (typeof pathOrMiddleware === "string") {
      name = nameOrPath;
      path = pathOrMiddleware;
    } else {
      path = nameOrPath;
      middleware.unshift(pathOrMiddleware);
    }

    this.#register(path, middleware, methods, { name });
  }

  #clone(): Router<RS> {
    const router = new Router<RS>(this.#opts);
    router.#methods = router.#methods.slice();
    router.#params = { ...this.#params };
    router.#stack = this.#stack.map((layer) => layer.clone());
    return router;
  }

  constructor(opts: RouterOptions = {}) {
    this.#opts = opts;
    this.#methods = opts.methods ?? [
      "DELETE",
      "GET",
      "HEAD",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT",
    ];
  }

  /** Register named middleware for the specified routes when the `DELETE`,
   * `GET`, `POST`, or `PUT` method is requested. */
  all<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `DELETE`,
   * `GET`, `POST`, or `PUT` method is requested. */
  all<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  all<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["DELETE", "GET", "POST", "PUT"],
    );
    return this;
  }

  /** Middleware that handles requests for HTTP methods registered with the
   * router.  If none of the routes handle a method, then "not allowed" logic
   * will be used.  If a method is supported by some routes, but not the
   * particular matched router, then "not implemented" will be returned.
   *
   * The middleware will also automatically handle the `OPTIONS` method,
   * responding with a `200 OK` when the `Allowed` header sent to the allowed
   * methods for a given route.
   *
   * By default, a "not allowed" request will respond with a `405 Not Allowed`
   * and a "not implemented" will respond with a `501 Not Implemented`. Setting
   * the option `.throw` to `true` will cause the middleware to throw an
   * `HTTPError` instead of setting the response status.  The error can be
   * overridden by providing a `.notImplemented` or `.notAllowed` method in the
   * options, of which the value will be returned will be thrown instead of the
   * HTTP error. */
  allowedMethods(
    options: RouterAllowedMethodsOptions = {},
  ): Middleware {
    const implemented = this.#methods;

    const allowedMethods: Middleware = async (context, next) => {
      const ctx = context as RouterContext<string>;
      await next();
      if (!ctx.response.status || ctx.response.status === Status.NotFound) {
        assert(ctx.matched);
        const allowed = new Set<HTTPMethods>();
        for (const route of ctx.matched) {
          for (const method of route.methods) {
            allowed.add(method);
          }
        }

        const allowedStr = [...allowed].join(", ");
        if (!implemented.includes(ctx.request.method)) {
          if (options.throw) {
            throw options.notImplemented
              ? options.notImplemented()
              : new httpErrors.NotImplemented();
          } else {
            ctx.response.status = Status.NotImplemented;
            ctx.response.headers.set("Allowed", allowedStr);
          }
        } else if (allowed.size) {
          if (ctx.request.method === "OPTIONS") {
            ctx.response.status = Status.OK;
            ctx.response.headers.set("Allowed", allowedStr);
          } else if (!allowed.has(ctx.request.method)) {
            if (options.throw) {
              throw options.methodNotAllowed
                ? options.methodNotAllowed()
                : new httpErrors.MethodNotAllowed();
            } else {
              ctx.response.status = Status.MethodNotAllowed;
              ctx.response.headers.set("Allowed", allowedStr);
            }
          }
        }
      }
    };

    return allowedMethods;
  }

  /** Register named middleware for the specified routes when the `DELETE`,
   *  method is requested. */
  delete<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `DELETE`,
   * method is requested. */
  delete<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  delete<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["DELETE"],
    );
    return this;
  }

  /** Iterate over the routes currently added to the router.  To be compatible
   * with the iterable interfaces, both the key and value are set to the value
   * of the route. */
  *entries(): IterableIterator<[Route<string>, Route<string>]> {
    for (const route of this.#stack) {
      const value = route.toJSON();
      yield [value, value];
    }
  }

  /** Iterate over the routes currently added to the router, calling the
   * `callback` function for each value. */
  forEach(
    callback: (
      value1: Route<string>,
      value2: Route<string>,
      router: this,
    ) => void,
    // deno-lint-ignore no-explicit-any
    thisArg: any = null,
  ): void {
    for (const route of this.#stack) {
      const value = route.toJSON();
      callback.call(thisArg, value, value, this);
    }
  }

  /** Register named middleware for the specified routes when the `GET`,
   *  method is requested. */
  get<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `GET`,
   * method is requested. */
  get<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  get<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["GET"],
    );
    return this;
  }

  /** Register named middleware for the specified routes when the `HEAD`,
   *  method is requested. */
  head<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `HEAD`,
   * method is requested. */
  head<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  head<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["HEAD"],
    );
    return this;
  }

  /** Iterate over the routes currently added to the router.  To be compatible
   * with the iterable interfaces, the key is set to the value of the route. */
  *keys(): IterableIterator<Route<string>> {
    for (const route of this.#stack) {
      yield route.toJSON();
    }
  }

  /** Register named middleware for the specified routes when the `OPTIONS`,
   * method is requested. */
  options<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `OPTIONS`,
   * method is requested. */
  options<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  options<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["OPTIONS"],
    );
    return this;
  }

  /** Register param middleware, which will be called when the particular param
   * is parsed from the route. */
  param<R extends string, S extends State = RS>(
    param: keyof RouteParams<R>,
    middleware: RouterParamMiddleware<R, RouteParams<R>, S>,
  ): Router<S> {
    this.#params[param as string] = middleware;
    for (const route of this.#stack) {
      route.param(param as string, middleware);
    }
    return this;
  }

  /** Register named middleware for the specified routes when the `PATCH`,
   * method is requested. */
  patch<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `PATCH`,
   * method is requested. */
  patch<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  patch<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["PATCH"],
    );
    return this;
  }

  /** Register named middleware for the specified routes when the `POST`,
   * method is requested. */
  post<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `POST`,
   * method is requested. */
  post<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  post<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["POST"],
    );
    return this;
  }

  /** Set the router prefix for this router. */
  prefix(prefix: string): this {
    prefix = prefix.replace(/\/$/, "");
    this.#opts.prefix = prefix;
    for (const route of this.#stack) {
      route.setPrefix(prefix);
    }
    return this;
  }

  /** Register named middleware for the specified routes when the `PUT`
   * method is requested. */
  put<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    name: string,
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware for the specified routes when the `PUT`
   * method is requested. */
  put<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  put<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    nameOrPath: string,
    pathOrMiddleware: string | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    this.#useVerb(
      nameOrPath,
      pathOrMiddleware as (string | RouterMiddleware<string>),
      middleware as RouterMiddleware<string>[],
      ["PUT"],
    );
    return this;
  }

  /** Register a direction middleware, where when the `source` path is matched
   * the router will redirect the request to the `destination` path.  A `status`
   * of `302 Found` will be set by default.
   *
   * The `source` and `destination` can be named routes. */
  redirect(
    source: string,
    destination: string | URL,
    status: RedirectStatus = Status.Found,
  ): this {
    if (source[0] !== "/") {
      const s = this.url(source);
      if (!s) {
        throw new RangeError(`Could not resolve named route: "${source}"`);
      }
      source = s;
    }
    if (typeof destination === "string") {
      if (destination[0] !== "/") {
        const d = this.url(destination);
        if (!d) {
          try {
            const url = new URL(destination);
            destination = url;
          } catch {
            throw new RangeError(`Could not resolve named route: "${source}"`);
          }
        } else {
          destination = d;
        }
      }
    }

    this.all(source, async (ctx, next) => {
      await next();
      ctx.response.redirect(destination);
      ctx.response.status = status;
    });
    return this;
  }

  /** Return middleware that will do all the route processing that the router
   * has been configured to handle.  Typical usage would be something like this:
   *
   * ```ts
   * import { Application, Router } from "https://deno.land/x/oak/mod.ts";
   *
   * const app = new Application();
   * const router = new Router();
   *
   * // register routes
   *
   * app.use(router.routes());
   * app.use(router.allowedMethods());
   * await app.listen({ port: 80 });
   * ```
   */
  routes(): Middleware {
    const dispatch = (
      context: Context,
      next: () => Promise<unknown>,
    ): Promise<unknown> => {
      const ctx = context as RouterContext<string>;
      let pathname: string;
      let method: HTTPMethods;
      try {
        const { url: { pathname: p }, method: m } = ctx.request;
        pathname = p;
        method = m;
      } catch (e) {
        return Promise.reject(e);
      }
      const path = this.#opts.routerPath ?? ctx.routerPath ??
        decodeURI(pathname);
      const matches = this.#match(path, method);

      if (ctx.matched) {
        ctx.matched.push(...matches.path);
      } else {
        ctx.matched = [...matches.path];
      }

      // deno-lint-ignore no-explicit-any
      ctx.router = this as Router<any>;

      if (!matches.route) return next();

      const { pathAndMethod: matchedRoutes } = matches;

      const chain = matchedRoutes.reduce(
        (prev, route) => [
          ...prev,
          (ctx, next) => {
            ctx.captures = route.captures(path);
            ctx.params = route.params(ctx.captures, ctx.params);
            ctx.routeName = route.name;
            return next();
          },
          ...route.stack,
        ],
        [] as RouterMiddleware<string>[],
      );
      return compose(chain)(ctx, next);
    };
    dispatch.router = this;
    return dispatch;
  }

  /** Generate a URL pathname for a named route, interpolating the optional
   * params provided.  Also accepts an optional set of options. */
  url<P extends RouteParams<string> = RouteParams<string>>(
    name: string,
    params?: P,
    options?: UrlOptions,
  ): string | undefined {
    const route = this.#route(name);

    if (route) {
      return route.url(params, options);
    }
  }

  /** Register middleware to be used on every matched route. */
  use<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    middleware: RouterMiddleware<string, P, S>,
    ...middlewares: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  /** Register middleware to be used on every route that matches the supplied
   * `path`. */
  use<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends State = RS,
  >(
    path: R,
    middleware: RouterMiddleware<R, P, S>,
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  use<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    path: string[],
    middleware: RouterMiddleware<string, P, S>,
    ...middlewares: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)>;
  use<
    P extends RouteParams<string> = RouteParams<string>,
    S extends State = RS,
  >(
    pathOrMiddleware: string | string[] | RouterMiddleware<string, P, S>,
    ...middleware: RouterMiddleware<string, P, S>[]
  ): Router<S extends RS ? S : (S & RS)> {
    let path: string | string[] | undefined;
    if (
      typeof pathOrMiddleware === "string" || Array.isArray(pathOrMiddleware)
    ) {
      path = pathOrMiddleware;
    } else {
      middleware.unshift(pathOrMiddleware);
    }

    this.#register(
      path ?? "(.*)",
      middleware as RouterMiddleware<string>[],
      [],
      { end: false, ignoreCaptures: !path, ignorePrefix: !path },
    );

    return this;
  }

  /** Iterate over the routes currently added to the router. */
  *values(): IterableIterator<Route<string, RouteParams<string>, RS>> {
    for (const route of this.#stack) {
      yield route.toJSON();
    }
  }

  /** Provide an iterator interface that iterates over the routes registered
   * with the router. */
  *[Symbol.iterator](): IterableIterator<
    Route<string, RouteParams<string>, RS>
  > {
    for (const route of this.#stack) {
      yield route.toJSON();
    }
  }

  /** Generate a URL pathname based on the provided path, interpolating the
   * optional params provided.  Also accepts an optional set of options. */
  static url<R extends string>(
    path: R,
    params?: RouteParams<R>,
    options?: UrlOptions,
  ): string {
    return toUrl(path, params, options);
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    return `${this.constructor.name} ${
      inspect({ "#params": this.#params, "#stack": this.#stack })
    }`;
  }
}
