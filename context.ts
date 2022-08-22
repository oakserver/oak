// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";
import { Cookies } from "./cookies.ts";
import { createHttpError } from "./deps.ts";
import { KeyStack } from "./keyStack.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { send, SendOptions } from "./send.ts";
import {
  ServerSentEventTargetOptions,
  SSEStreamTarget,
} from "./server_sent_event.ts";
import type { ServerSentEventTarget } from "./server_sent_event.ts";
import type {
  ErrorStatus,
  ServerRequest,
  UpgradeWebSocketOptions,
} from "./types.d.ts";

export interface ContextOptions<
  S extends AS = State,
  // deno-lint-ignore no-explicit-any
  AS extends State = Record<string, any>,
> {
  jsonBodyReplacer?: (
    key: string,
    value: unknown,
    context: Context<S>,
  ) => unknown;
  jsonBodyReviver?: (
    key: string,
    value: unknown,
    context: Context<S>,
  ) => unknown;
  secure?: boolean;
}

export interface ContextSendOptions extends SendOptions {
  /** The filename to send, which will be resolved based on the other options.
   * If this property is omitted, the current context's `.request.url.pathname`
   * will be used. */
  path?: string;
}

/** Provides context about the current request and response to middleware
 * functions, and the current instance being processed is the first argument
 * provided a {@linkcode Middleware} function.
 *
 * _Typically this is only used as a type annotation and shouldn't be
 * constructed directly._
 *
 * ### Example
 *
 * ```ts
 * import { Application, Context } from "https://deno.land/x/oak/mod.ts";
 *
 * const app = new Application();
 *
 * app.use((ctx) => {
 *   // information about the request is here:
 *   ctx.request;
 *   // information about the response is here:
 *   ctx.response;
 *   // the cookie store is here:
 *   ctx.cookies;
 * });
 *
 * // Needs a type annotation because it cannot be inferred.
 * function mw(ctx: Context) {
 *   // process here...
 * }
 *
 * app.use(mw);
 * ```
 *
 * @template S the state which extends the application state (`AS`)
 * @template AS the type of the state derived from the application
 */
export class Context<
  S extends AS = State,
  // deno-lint-ignore no-explicit-any
  AS extends State = Record<string, any>,
> {
  #socket?: WebSocket;
  #sse?: ServerSentEventTarget;

  #wrapReviverReplacer(
    reviver?: (key: string, value: unknown, context: this) => unknown,
  ): undefined | ((key: string, value: unknown) => unknown) {
    return reviver
      ? (key: string, value: unknown) => reviver(key, value, this)
      : undefined;
  }

  /** A reference to the current application. */
  app: Application<AS>;

  /** An object which allows access to cookies, mediating both the request and
   * response. */
  cookies: Cookies;

  /** Is `true` if the current connection is upgradeable to a web socket.
   * Otherwise the value is `false`.  Use `.upgrade()` to upgrade the connection
   * and return the web socket. */
  get isUpgradable(): boolean {
    const upgrade = this.request.headers.get("upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return false;
    }
    const secKey = this.request.headers.get("sec-websocket-key");
    return typeof secKey === "string" && secKey != "";
  }

  /** Determines if the request should be responded to.  If `false` when the
   * middleware completes processing, the response will not be sent back to the
   * requestor.  Typically this is used if the middleware will take over low
   * level processing of requests and responses, for example if using web
   * sockets.  This automatically gets set to `false` when the context is
   * upgraded to a web socket via the `.upgrade()` method.
   *
   * The default is `true`. */
  respond: boolean;

  /** An object which contains information about the current request. */
  request: Request;

  /** An object which contains information about the response that will be sent
   * when the middleware finishes processing. */
  response: Response;

  /** If the the current context has been upgraded, then this will be set to
   * with the current web socket, otherwise it is `undefined`. */
  get socket(): WebSocket | undefined {
    return this.#socket;
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
  state: S;

  constructor(
    app: Application<AS>,
    serverRequest: ServerRequest,
    state: S,
    {
      secure = false,
      jsonBodyReplacer,
      jsonBodyReviver,
    }: ContextOptions<S, AS> = {},
  ) {
    this.app = app;
    this.state = state;
    const { proxy } = app;
    this.request = new Request(
      serverRequest,
      {
        proxy,
        secure,
        jsonBodyReviver: this.#wrapReviverReplacer(jsonBodyReviver),
      },
    );
    this.respond = true;
    this.response = new Response(
      this.request,
      this.#wrapReviverReplacer(jsonBodyReplacer),
    );
    this.cookies = new Cookies(this.request, this.response, {
      keys: this.app.keys as KeyStack | undefined,
      secure: this.request.secure,
    });
  }

  /** Asserts the condition and if the condition fails, creates an HTTP error
   * with the provided status (which defaults to `500`).  The error status by
   * default will be set on the `.response.status`.
   *
   * Because of limitation of TypeScript, any assertion type function requires
   * specific type annotations, so the {@linkcode Context} type should be used
   * even if it can be inferred from the context.
   *
   * ### Example
   *
   * ```ts
   * import { Context, Status } from "https://deno.land/x/oak/mod.ts";
   *
   * export function mw(ctx: Context) {
   *   const body = ctx.request.body();
   *   ctx.assert(body.type === "json", Status.NotAcceptable);
   *   // process the body and send a response...
   * }
   * ```
   */
  assert(
    // deno-lint-ignore no-explicit-any
    condition: any,
    errorStatus: ErrorStatus = 500,
    message?: string,
    props?: Record<string, unknown>,
  ): asserts condition {
    if (condition) {
      return;
    }
    const err = createHttpError(errorStatus, message);
    if (props) {
      Object.assign(err, props);
    }
    throw err;
  }

  /** Asynchronously fulfill a response with a file from the local file
   * system.
   *
   * If the `options.path` is not supplied, the file to be sent will default
   * to this `.request.url.pathname`.
   *
   * Requires Deno read permission. */
  send(options: ContextSendOptions): Promise<string | undefined> {
    const { path = this.request.url.pathname, ...sendOptions } = options;
    return send(this, path, sendOptions);
  }

  /** Convert the connection to stream events, returning an event target for
   * sending server sent events.  Events dispatched on the returned target will
   * be sent to the client and be available in the client's `EventSource` that
   * initiated the connection.
   *
   * This will set `.respond` to `false`. */
  sendEvents(options?: ServerSentEventTargetOptions): ServerSentEventTarget {
    if (!this.#sse) {
      this.#sse = new SSEStreamTarget(this, options);
    }
    return this.#sse;
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
    const err = createHttpError(errorStatus, message);
    if (props) {
      Object.assign(err, props);
    }
    throw err;
  }

  /** Take the current request and upgrade it to a web socket, resolving with
   * the a web standard `WebSocket` object. This will set `.respond` to
   * `false`.  If the socket cannot be upgraded, this method will throw. */
  upgrade(options?: UpgradeWebSocketOptions): WebSocket {
    if (this.#socket) {
      return this.#socket;
    }
    if (!this.request.originalRequest.upgrade) {
      throw new TypeError(
        "Web socket upgrades not currently supported for this type of server.",
      );
    }
    this.#socket = this.request.originalRequest.upgrade(options);
    this.respond = false;
    return this.#socket;
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    const {
      app,
      cookies,
      isUpgradable,
      respond,
      request,
      response,
      socket,
      state,
    } = this;
    return `${this.constructor.name} ${
      inspect({
        app,
        cookies,
        isUpgradable,
        respond,
        request,
        response,
        socket,
        state,
      })
    }`;
  }

  [Symbol.for("nodejs.util.inspect.custom")](
    depth: number,
    // deno-lint-ignore no-explicit-any
    options: any,
    inspect: (value: unknown, options?: unknown) => string,
  ) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }

    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1,
    });
    const {
      app,
      cookies,
      isUpgradable,
      respond,
      request,
      response,
      socket,
      state,
    } = this;
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect({
        app,
        cookies,
        isUpgradable,
        respond,
        request,
        response,
        socket,
        state,
      }, newOptions)
    }`;
  }
}
