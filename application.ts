// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { Context } from "./context.ts";
import { assert, Status, STATUS_TEXT } from "./deps.ts";
import {
  hasNativeHttp,
  HttpServerNative,
  NativeRequest,
} from "./http_server_native.ts";
import { HttpServerStd } from "./http_server_std.ts";
import type { ServerRequest, ServerResponse } from "./http_server_std.ts";
import { KeyStack } from "./keyStack.ts";
import { compose, Middleware } from "./middleware.ts";
import { cloneState } from "./structured_clone.ts";
import {
  FetchEventListenerObject,
  Key,
  Server,
  ServerConstructor,
} from "./types.d.ts";
import { isConn } from "./util.ts";

export interface ListenOptionsBase extends Deno.ListenOptions {
  secure?: false;
  signal?: AbortSignal;
}

export interface ListenOptionsTls extends Deno.ListenTlsOptions {
  /** Application-Layer Protocol Negotiation (ALPN) protocols to announce to
   * the client. If not specified, no ALPN extension will be included in the
   * TLS handshake.
   *
   * **NOTE** this is part of the native HTTP server in Deno 1.9 or later,
   * which requires the `--unstable` flag to be available.
   */
  alpnProtocols?: string[];
  secure: true;
  signal?: AbortSignal;
}

export interface HandleMethod {
  /** Handle an individual server request, returning the server response.  This
   * is similar to `.listen()`, but opening the connection and retrieving
   * requests are not the responsibility of the application.  If the generated
   * context gets set to not to respond, then the method resolves with
   * `undefined`, otherwise it resolves with a request that is compatible with
   * `std/http/server`. */
  (
    request: ServerRequest,
    secure?: boolean,
  ): Promise<ServerResponse | undefined>;
  /** Handle an individual server request, returning the server response.  This
   * is similar to `.listen()`, but opening the connection and retrieving
   * requests are not the responsibility of the application.  If the generated
   * context gets set to not to respond, then the method resolves with
   * `undefined`, otherwise it resolves with a request that is compatible with
   * `std/http/server`. */
  (
    request: Request,
    conn?: Deno.Conn,
    secure?: boolean,
  ): Promise<Response | undefined>;
}

export type ListenOptions = ListenOptionsTls | ListenOptionsBase;

interface ApplicationErrorEventListener<S extends AS, AS> {
  (evt: ApplicationErrorEvent<S, AS>): void | Promise<void>;
}

interface ApplicationErrorEventListenerObject<S extends AS, AS> {
  handleEvent(evt: ApplicationErrorEvent<S, AS>): void | Promise<void>;
}

interface ApplicationErrorEventInit<S extends AS, AS extends State>
  extends ErrorEventInit {
  context?: Context<S, AS>;
}

type ApplicationErrorEventListenerOrEventListenerObject<S extends AS, AS> =
  | ApplicationErrorEventListener<S, AS>
  | ApplicationErrorEventListenerObject<S, AS>;

interface ApplicationListenEventListener {
  (evt: ApplicationListenEvent): void | Promise<void>;
}

interface ApplicationListenEventListenerObject {
  handleEvent(evt: ApplicationListenEvent): void | Promise<void>;
}

interface ApplicationListenEventInit extends EventInit {
  hostname: string;
  listener: Deno.Listener;
  port: number;
  secure: boolean;
  serverType: "std" | "native" | "custom";
}

type ApplicationListenEventListenerOrEventListenerObject =
  | ApplicationListenEventListener
  | ApplicationListenEventListenerObject;

export interface ApplicationOptions<S> {
  /** Determine how when creating a new context, the state from the application
   * should be applied. A value of `"clone"` will set the state as a clone of
   * the app state. Any non-cloneable or non-enumerable properties will not be
   * copied. A value of `"prototype"` means that the application's state will be
   * used as the prototype of the the context's state, meaning shallow
   * properties on the context's state will not be reflected in the
   * application's state. A value of `"alias"` means that application's `.state`
   * and the context's `.state` will be a reference to the same object. A value
   * of `"empty"` will initialize the context's `.state` with an empty object.
   *
   * The default value is `"clone"`.
   */
  contextState?: "clone" | "prototype" | "alias" | "empty";

  /** An initial set of keys (or instance of `KeyGrip`) to be used for signing
   * cookies produced by the application. */
  keys?: KeyStack | Key[];

  /** If `true`, any errors handled by the application will be logged to the
   * stderr. If `false` nothing will be logged. The default is `true`.
   *
   * All errors are available as events on the application of type `"error"` and
   * can be accessed for custom logging/application management via adding an
   * event listener to the application:
   *
   * ```ts
   * const app = new Application({ logErrors: false });
   * app.addEventListener("error", (evt) => {
   *   // evt.error will contain what error was thrown
   * });
   * ```
   */
  logErrors?: boolean;

  /** If set to `true`, proxy headers will be trusted when processing requests.
   * This defaults to `false`. */
  proxy?: boolean;

  /** A server constructor to use instead of the default server for receiving
   * requests.  When the native HTTP server is detected in the environment, then
   * the native server will be used, otherwise the `std/http` server will be
   * used.  Passing either `HTTPServerStd` or `HTTPServerNative` will override
   * this behavior.
   */
  serverConstructor?: ServerConstructor<ServerRequest | NativeRequest>;

  /** The initial state object for the application, of which the type can be
   * used to infer the type of the state for both the application and any of the
   * application's context. */
  state?: S;
}

export interface FetchEventHandlerOptions {
  /** Sets the applications `.proxy` value, which determines if proxy headers
   * are used when determining values in the request. This defaults to `true`.
   */
  proxy?: boolean;
  /** Determines if requests handled by the fetch event handler should be
   * treated as "secure" (e.g. served over HTTP). This defaults to `true`. */
  secure?: boolean;
}

interface RequestState {
  handling: Set<Promise<void>>;
  closing: boolean;
  closed: boolean;
  server: Server<ServerRequest | NativeRequest>;
}

// deno-lint-ignore no-explicit-any
export type State = Record<string | number | symbol, any>;

const ADDR_REGEXP = /^\[?([^\]]*)\]?:([0-9]{1,5})$/;

export class ApplicationErrorEvent<S extends AS, AS extends State>
  extends ErrorEvent {
  context?: Context<S, AS>;

  constructor(eventInitDict: ApplicationErrorEventInit<S, AS>) {
    super("error", eventInitDict);
    this.context = eventInitDict.context;
  }
}

function logErrorListener<S extends AS, AS extends State>(
  { error, context }: ApplicationErrorEvent<S, AS>,
) {
  if (error instanceof Error) {
    console.error(
      `[uncaught application error]: ${error.name} - ${error.message}`,
    );
  } else {
    console.error(`[uncaught application error]\n`, error);
  }
  if (context) {
    let url: string;
    try {
      url = context.request.url.toString();
    } catch {
      url = "[malformed url]";
    }
    console.error(`\nrequest:`, {
      url,
      method: context.request.method,
      hasBody: context.request.hasBody,
    });
    console.error(`response:`, {
      status: context.response.status,
      type: context.response.type,
      hasBody: !!context.response.body,
      writable: context.response.writable,
    });
  }
  if (error instanceof Error && error.stack) {
    console.error(`\n${error.stack.split("\n").slice(1).join("\n")}`);
  }
}

export class ApplicationListenEvent extends Event {
  hostname: string;
  listener: Deno.Listener;
  port: number;
  secure: boolean;
  serverType: "std" | "native" | "custom";

  constructor(eventInitDict: ApplicationListenEventInit) {
    super("listen", eventInitDict);
    this.hostname = eventInitDict.hostname;
    this.listener = eventInitDict.listener;
    this.port = eventInitDict.port;
    this.secure = eventInitDict.secure;
    this.serverType = eventInitDict.serverType;
  }
}

/** A class which registers middleware (via `.use()`) and then processes
 * inbound requests against that middleware (via `.listen()`).
 *
 * The `context.state` can be typed via passing a generic argument when
 * constructing an instance of `Application`.
 */
// deno-lint-ignore no-explicit-any
export class Application<AS extends State = Record<string, any>>
  extends EventTarget {
  #composedMiddleware?: (context: Context<AS, AS>) => Promise<unknown>;
  #contextState: "clone" | "prototype" | "alias" | "empty";
  #eventHandler?: FetchEventListenerObject;
  #keys?: KeyStack;
  #middleware: Middleware<State, Context<State, AS>>[] = [];
  #serverConstructor: ServerConstructor<ServerRequest | NativeRequest>;

  /** A set of keys, or an instance of `KeyStack` which will be used to sign
   * cookies read and set by the application to avoid tampering with the
   * cookies. */
  get keys(): KeyStack | Key[] | undefined {
    return this.#keys;
  }

  set keys(keys: KeyStack | Key[] | undefined) {
    if (!keys) {
      this.#keys = undefined;
      return;
    } else if (Array.isArray(keys)) {
      this.#keys = new KeyStack(keys);
    } else {
      this.#keys = keys;
    }
  }

  /** If `true`, proxy headers will be trusted when processing requests.  This
   * defaults to `false`. */
  proxy: boolean;

  /** Generic state of the application, which can be specified by passing the
   * generic argument when constructing:
   *
   *       const app = new Application<{ foo: string }>();
   *
   * Or can be contextually inferred based on setting an initial state object:
   *
   *       const app = new Application({ state: { foo: "bar" } });
   *
   * When a new context is created, the application's state is cloned and the
   * state is unique to that request/response.  Changes can be made to the
   * application state that will be shared with all contexts.
   */
  state: AS;

  constructor(options: ApplicationOptions<AS> = {}) {
    super();
    const {
      state,
      keys,
      proxy,
      serverConstructor = hasNativeHttp() ? HttpServerNative : HttpServerStd,
      contextState = "clone",
      logErrors = true,
    } = options;

    this.proxy = proxy ?? false;
    this.keys = keys;
    this.state = state ?? {} as AS;
    this.#serverConstructor = serverConstructor;
    this.#contextState = contextState;

    if (logErrors) {
      this.addEventListener("error", logErrorListener);
    }
  }

  #getComposed(): ((context: Context<AS, AS>) => Promise<unknown>) {
    if (!this.#composedMiddleware) {
      this.#composedMiddleware = compose(this.#middleware);
    }
    return this.#composedMiddleware;
  }

  #getContextState(): AS {
    switch (this.#contextState) {
      case "alias":
        return this.state;
      case "clone":
        return cloneState(this.state);
      case "empty":
        return {} as AS;
      case "prototype":
        return Object.create(this.state);
    }
  }

  /** Deal with uncaught errors in either the middleware or sending the
   * response. */
  // deno-lint-ignore no-explicit-any
  #handleError(context: Context<AS>, error: any): void {
    if (!(error instanceof Error)) {
      error = new Error(`non-error thrown: ${JSON.stringify(error)}`);
    }
    const { message } = error;
    this.dispatchEvent(new ApplicationErrorEvent({ context, message, error }));
    if (!context.response.writable) {
      return;
    }
    for (const key of [...context.response.headers.keys()]) {
      context.response.headers.delete(key);
    }
    if (error.headers && error.headers instanceof Headers) {
      for (const [key, value] of error.headers) {
        context.response.headers.set(key, value);
      }
    }
    context.response.type = "text";
    const status: Status = context.response.status =
      Deno.errors && error instanceof Deno.errors.NotFound
        ? 404
        : error.status && typeof error.status === "number"
        ? error.status
        : 500;
    context.response.body = error.expose
      ? error.message
      : STATUS_TEXT.get(status);
  }

  /** Processing registered middleware on each request. */
  async #handleRequest(
    request: ServerRequest | NativeRequest,
    secure: boolean,
    state: RequestState,
  ): Promise<void> {
    const context = new Context(this, request, this.#getContextState(), secure);
    let resolve: () => void;
    const handlingPromise = new Promise<void>((res) => resolve = res);
    state.handling.add(handlingPromise);
    if (!state.closing && !state.closed) {
      try {
        await this.#getComposed()(context);
      } catch (err) {
        this.#handleError(context, err);
      }
    }
    if (context.respond === false) {
      context.response.destroy();
      resolve!();
      state.handling.delete(handlingPromise);
      return;
    }
    let closeResources = true;
    let response: Response | ServerResponse;
    try {
      if (request instanceof NativeRequest) {
        closeResources = false;
        response = await context.response.toDomResponse();
      } else {
        response = await context.response.toServerResponse();
      }
    } catch (err) {
      this.#handleError(context, err);
      if (request instanceof NativeRequest) {
        response = await context.response.toDomResponse();
      } else {
        response = await context.response.toServerResponse();
      }
    }
    assert(response);
    try {
      await request.respond(response as Response & ServerResponse);
    } catch (err) {
      this.#handleError(context, err);
    } finally {
      context.response.destroy(closeResources);
      resolve!();
      state.handling.delete(handlingPromise);
      if (state.closing) {
        state.server.close();
        state.closed = true;
      }
    }
  }

  /** Add an event listener for an `"error"` event which occurs when an
   * un-caught error occurs when processing the middleware or during processing
   * of the response. */
  addEventListener<S extends AS>(
    type: "error",
    listener: ApplicationErrorEventListenerOrEventListenerObject<S, AS> | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /** Add an event listener for a `"listen"` event which occurs when the server
   * has successfully opened but before any requests start being processed. */
  addEventListener(
    type: "listen",
    listener: ApplicationListenEventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /** Add an event listener for an event.  Currently valid event types are
   * `"error"` and `"listen"`. */
  addEventListener(
    type: "error" | "listen",
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener, options);
  }

  /** **DEPRECATED**
   *
   * Deno Deploy now supports request events like the Deno CLI. Users should
   * use `app.listen()` just like if they were running on the Deno CLI for
   * Deploy apps.  This method will be removed in future versions of oak.
   *
   * @deprecated This method will be removed in future versions of oak
   */
  fetchEventHandler(
    { proxy = true, secure = true }: FetchEventHandlerOptions = {},
  ): FetchEventListenerObject {
    if (this.#eventHandler) {
      return this.#eventHandler;
    }
    this.proxy = proxy;
    return this.#eventHandler = {
      handleEvent: async (requestEvent) => {
        let resolve: (response: Response) => void;
        // deno-lint-ignore no-explicit-any
        let reject: (reason: any) => void;
        const responsePromise = new Promise<Response>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        const respondedPromise = requestEvent.respondWith(responsePromise);
        const response = await this.handle(
          requestEvent.request,
          undefined,
          secure,
        );
        if (response) {
          resolve!(response);
        } else {
          reject!(new Error("No response returned from app handler."));
        }
        try {
          await respondedPromise;
        } catch (error) {
          this.dispatchEvent(new ApplicationErrorEvent({ error }));
        }
      },
    };
  }

  /** Handle an individual server request, returning the server response.  This
   * is similar to `.listen()`, but opening the connection and retrieving
   * requests are not the responsibility of the application.  If the generated
   * context gets set to not to respond, then the method resolves with
   * `undefined`, otherwise it resolves with a request that is compatible with
   * `std/http/server`. */
  handle = (async (
    request: ServerRequest | Request,
    secureOrConn: Deno.Conn | boolean | undefined,
    secure: boolean | undefined = false,
  ): Promise<ServerResponse | Response | undefined> => {
    if (!this.#middleware.length) {
      throw new TypeError("There is no middleware to process requests.");
    }
    let contextRequest: ServerRequest | NativeRequest;
    if (request instanceof Request) {
      assert(isConn(secureOrConn) || typeof secureOrConn === "undefined");
      contextRequest = new NativeRequest({
        request,
        respondWith() {
          return Promise.resolve(undefined);
        },
      }, { conn: secureOrConn });
    } else {
      assert(
        typeof secureOrConn === "boolean" ||
          typeof secureOrConn === "undefined",
      );
      secure = secureOrConn ?? false;
      contextRequest = request;
    }
    const context = new Context(
      this,
      contextRequest,
      this.#getContextState(),
      secure,
    );
    try {
      await this.#getComposed()(context);
    } catch (err) {
      this.#handleError(context, err);
    }
    if (context.respond === false) {
      context.response.destroy();
      return;
    }
    try {
      const response = contextRequest instanceof NativeRequest
        ? await context.response.toDomResponse()
        : await context.response.toServerResponse();
      context.response.destroy(false);
      return response;
    } catch (err) {
      this.#handleError(context, err);
      throw err;
    }
  }) as HandleMethod;

  /** Start listening for requests, processing registered middleware on each
   * request.  If the options `.secure` is undefined or `false`, the listening
   * will be over HTTP.  If the options `.secure` property is `true`, a
   * `.certFile` and a `.keyFile` property need to be supplied and requests
   * will be processed over HTTPS. */
  async listen(addr: string): Promise<void>;
  /** Start listening for requests, processing registered middleware on each
   * request.  If the options `.secure` is undefined or `false`, the listening
   * will be over HTTP.  If the options `.secure` property is `true`, a
   * `.certFile` and a `.keyFile` property need to be supplied and requests
   * will be processed over HTTPS. */
  async listen(options: ListenOptions): Promise<void>;
  async listen(options: string | ListenOptions): Promise<void> {
    if (!this.#middleware.length) {
      throw new TypeError("There is no middleware to process requests.");
    }
    if (typeof options === "string") {
      const match = ADDR_REGEXP.exec(options);
      if (!match) {
        throw TypeError(`Invalid address passed: "${options}"`);
      }
      const [, hostname, portStr] = match;
      options = { hostname, port: parseInt(portStr, 10) };
    }
    const server = new this.#serverConstructor(this, options);
    const { signal } = options;
    const state = {
      closed: false,
      closing: false,
      handling: new Set<Promise<void>>(),
      server,
    };
    if (signal) {
      signal.addEventListener("abort", () => {
        if (!state.handling.size) {
          server.close();
          state.closed = true;
        }
        state.closing = true;
      });
    }
    const { secure = false } = options;
    const serverType = server instanceof HttpServerStd
      ? "std"
      : server instanceof HttpServerNative
      ? "native"
      : "custom";
    const listener = server.listen();
    const { hostname, port } = listener.addr as Deno.NetAddr;
    this.dispatchEvent(
      new ApplicationListenEvent({
        hostname,
        listener,
        port,
        secure,
        serverType,
      }),
    );
    try {
      for await (const request of server) {
        this.#handleRequest(request, secure, state);
      }
      await Promise.all(state.handling);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Application Error";
      this.dispatchEvent(
        new ApplicationErrorEvent({ message, error }),
      );
    }
  }

  /** Register middleware to be used with the application.  Middleware will
   * be processed in the order it is added, but middleware can control the flow
   * of execution via the use of the `next()` function that the middleware
   * function will be called with.  The `context` object provides information
   * about the current state of the application.
   *
   * Basic usage:
   *
   * ```ts
   * const import { Application } from "https://deno.land/x/oak/mod.ts";
   *
   * const app = new Application();
   *
   * app.use((ctx, next) => {
   *   ctx.request; // contains request information
   *   ctx.response; // setups up information to use in the response;
   *   await next(); // manages the flow control of the middleware execution
   * });
   *
   * await app.listen({ port: 80 });
   * ```
   */
  use<S extends State = AS>(
    middleware: Middleware<S, Context<S, AS>>,
    ...middlewares: Middleware<S, Context<S, AS>>[]
  ): Application<S extends AS ? S : (S & AS)>;
  use<S extends State = AS>(
    ...middleware: Middleware<S, Context<S, AS>>[]
  ): Application<S extends AS ? S : (S & AS)> {
    this.#middleware.push(...middleware);
    this.#composedMiddleware = undefined;
    // deno-lint-ignore no-explicit-any
    return this as Application<any>;
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    const { keys, proxy, state } = this;
    return `${this.constructor.name} ${
      inspect({ "#middleware": this.#middleware, keys, proxy, state })
    }`;
  }
}
