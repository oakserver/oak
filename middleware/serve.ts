// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/** Middleware that converts the oak specific context to a Fetch API standard
 * {@linkcode Request} and {@linkcode Response} along with a modified context
 * providing some of the oak functionality. This is intended to make it easier
 * to adapt code to work with oak.
 *
 * There are two functions which will "wrap" a handler that operates off a
 * Fetch API request and response and return an oak middleware. The
 * {@linkcode serve} is designed for using with the {@linkcode Application}
 * `.use()` method, while {@linkcode route} is designed for using with the
 * {@linkcode Router}.
 *
 * > [!IMPORTANT]
 * > This is not intended for advanced use cases that are supported by oak,
 * > like integrated cookie management, web sockets and server sent events.
 * >
 * > Also, these are designed to be very deterministic request/response handlers
 * > versus a more nuanced middleware stack which allows advanced control.
 * > Therefore there is no `next()`.
 * >
 * > For these advanced use cases, create middleware without the wrapper.
 *
 * @module
 */

import type { Application, State } from "../application.ts";
import type { Context } from "../context.ts";
import type { ErrorStatus, HttpErrorOptions } from "../deps.ts";
import type { Middleware } from "../middleware.ts";
import type {
  Layer,
  RouteParams,
  Router,
  RouterContext,
  RouterMiddleware,
} from "../router.ts";

/** The context associated when dealing with serve middleware requests on an
 * application. */
export class ServeContext<S extends State = State> {
  #context: Context<S>;

  /** A reference to the current application. */
  get app(): Application<S> {
    return this.#context.app as Application<S>;
  }

  /** Request remote address. When the application's `.proxy` is true, the
   * `X-Forwarded-For` will be used to determine the requesting remote address.
   */
  get ip(): string {
    return this.#context.request.ip;
  }

  /** When the application's `.proxy` is `true`, this will be set to an array of
   * IPs, ordered from upstream to downstream, based on the value of the header
   * `X-Forwarded-For`.  When `false` an empty array is returned. */
  get ips(): string[] {
    return this.#context.request.ips;
  }

  /** The object to pass state to front-end views.  This can be typed by
   * supplying the generic state argument when creating a new app.  For
   * example:
   *
   * ```ts
   * const app = new Application<{ foo: string }>();
   * ```
   *
   * Or can be contextually inferred based on setting an initial state object:
   *
   * ```ts
   * const app = new Application({ state: { foo: "bar" } });
   * ```
   *
   * On each request/response cycle, the context's state is cloned from the
   * application state. This means changes to the context's `.state` will be
   * dropped when the request drops, but "defaults" can be applied to the
   * application's state.  Changes to the application's state though won't be
   * reflected until the next request in the context's state.
   */
  get state(): S {
    return this.#context.state;
  }

  constructor(context: Context<S>) {
    this.#context = context;
  }

  /** Asserts the condition and if the condition fails, creates an HTTP error
   * with the provided status (which defaults to `500`).  The error status by
   * default will be set on the `.response.status`.
   *
   * Because of limitation of TypeScript, any assertion type function requires
   * specific type annotations, so the {@linkcode ServeContext} type should be
   * used even if it can be inferred from the context.
   */
  assert(
    condition: unknown,
    status?: ErrorStatus,
    message?: string,
    props?: Record<string, unknown> & Omit<HttpErrorOptions, "status">,
  ): asserts condition {
    this.#context.assert(condition, status, message, props);
  }

  /** Create and throw an HTTP Error, which can be used to pass status
   * information which can be caught by other middleware to send more
   * meaningful error messages back to the client.  The passed error status will
   * be set on the `.response.status` by default as well.
   */
  throw(
    errorStatus: ErrorStatus,
    message?: string,
    props?: Record<string, unknown>,
  ): never {
    this.#context.throw(errorStatus, message, props);
  }

  [Symbol.for("Deno.customInspect")](
    inspect: (value: unknown) => string,
  ): string {
    const { app, ip, ips, state } = this;
    return `${this.constructor.name} ${inspect({ app, ip, ips, state })}`;
  }

  [Symbol.for("nodejs.util.inspect.custom")](
    depth: number,
    // deno-lint-ignore no-explicit-any
    options: any,
    inspect: (value: unknown, options?: unknown) => string,
    // deno-lint-ignore no-explicit-any
  ): any {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }

    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1,
    });
    const { app, ip, ips, state } = this;
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect({ app, ip, ips, state }, newOptions)
    }`;
  }
}

/** The context associated with serve middleware requests on a router. */
export class RouteContext<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  S extends State = State,
> extends ServeContext<S> {
  #captures: string[];
  #matched?: Layer<R, P, S>[];
  #params: P;
  #router: Router<S>;
  #routeName?: string;
  #routerPath?: string;

  /** When matching the route, an array of the capturing groups from the regular
   * expression. */
  get captures(): string[] {
    return this.#captures;
  }

  /** The routes that were matched for this request. */
  get matched(): Layer<R, P, S>[] | undefined {
    return this.#matched;
  }

  /** Any parameters parsed from the route when matched. */
  get params(): P {
    return this.#params;
  }

  /** A reference to the router instance. */
  get router(): Router<S> {
    return this.#router;
  }

  /** If the matched route has a `name`, the matched route name is provided
   * here. */
  get routeName(): string | undefined {
    return this.#routeName;
  }

  /** Overrides the matched path for future route middleware, when a
   * `routerPath` option is not defined on the `Router` options. */
  get routerPath(): string | undefined {
    return this.#routerPath;
  }

  constructor(context: RouterContext<R, P, S>) {
    super(context);
    const { captures, matched, params, router, routeName, routerPath } =
      context;
    this.#captures = captures;
    this.#matched = matched;
    this.#params = params;
    this.#router = router;
    this.#routeName = routeName;
    this.#routerPath = routerPath;
  }

  [Symbol.for("Deno.customInspect")](
    inspect: (value: unknown) => string,
  ): string {
    const {
      app,
      captures,
      matched,
      ip,
      ips,
      params,
      router,
      routeName,
      routerPath,
      state,
    } = this;
    return `${this.constructor.name} ${
      inspect({
        app,
        captures,
        matched,
        ip,
        ips,
        params,
        router,
        routeName,
        routerPath,
        state,
      })
    }`;
  }

  [Symbol.for("nodejs.util.inspect.custom")](
    depth: number,
    // deno-lint-ignore no-explicit-any
    options: any,
    inspect: (value: unknown, options?: unknown) => string,
    // deno-lint-ignore no-explicit-any
  ): any {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }

    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1,
    });
    const {
      app,
      captures,
      matched,
      ip,
      ips,
      params,
      router,
      routeName,
      routerPath,
      state,
    } = this;
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect({
        app,
        captures,
        matched,
        ip,
        ips,
        params,
        router,
        routeName,
        routerPath,
        state,
      }, newOptions)
    }`;
  }
}

type ServeMiddleware<S extends State> = (
  request: Request,
  context: ServeContext<S>,
) => Response | Promise<Response>;

type ServeRouterMiddleware<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
> = (
  request: Request,
  context: RouteContext<R, P, S>,
) => Response | Promise<Response>;

/** Wrap a handler function to generate middleware that can be used with an oak
 * {@linkcode Application}. This allows the handler to deal with a Fetch API
 * standard {@linkcode Request} and return a standard {@linkcode Response}.
 */
export function serve<S extends State>(
  middleware: ServeMiddleware<S>,
): Middleware<S> {
  return async (ctx, next) => {
    const request = ctx.request.source ?? new Request(ctx.request.url, {
      ...ctx.request,
      body: ctx.request.body.stream,
    });
    const context = new ServeContext(ctx);
    const response = await middleware(request, context);
    ctx.response.with(response);
    return next();
  };
}

/** Wrap a handler function to generate middleware that can be used with an oak
 * {@linkcode Router}. This allows the handler to deal with a Fetch API standard
 * {@linkcode Request} and return a standard {@linkcode Response}.
 */
export function route<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(middleware: ServeRouterMiddleware<R, P, S>): RouterMiddleware<R, P, S> {
  return async (ctx, next) => {
    const request = ctx.request.source ?? new Request(ctx.request.url, {
      ...ctx.request,
      body: ctx.request.body.stream,
    });
    const context = new RouteContext(ctx);
    const response = await middleware(request, context);
    ctx.response.with(response);
    return next();
  };
}
