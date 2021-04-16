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
import { Key, KeyStack } from "./keyStack.ts";
import { compose, Middleware } from "./middleware.ts";
import { Server, ServerConstructor } from "./types.d.ts";
import { isConn } from "./util.ts";

export interface ListenOptionsBase extends Deno.ListenOptions {
  secure?: false;
  signal?: AbortSignal;
}

export interface ListenOptionsTls extends Deno.ListenTlsOptions {
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
    conn?: Deno.Conn<Deno.NetAddr>,
    secure?: boolean,
  ): Promise<Response | undefined>;
}

export type ListenOptions = ListenOptionsTls | ListenOptionsBase;

interface ApplicationErrorEventListener<S> {
  (evt: ApplicationErrorEvent<S>): void | Promise<void>;
}

interface ApplicationErrorEventListenerObject<S> {
  handleEvent(evt: ApplicationErrorEvent<S>): void | Promise<void>;
}

interface ApplicationErrorEventInit<S extends State> extends ErrorEventInit {
  context?: Context<S>;
}

type ApplicationErrorEventListenerOrEventListenerObject<S> =
  | ApplicationErrorEventListener<S>
  | ApplicationErrorEventListenerObject<S>;

interface ApplicationListenEventListener {
  (evt: ApplicationListenEvent): void | Promise<void>;
}

interface ApplicationListenEventListenerObject {
  handleEvent(evt: ApplicationListenEvent): void | Promise<void>;
}

interface ApplicationListenEventInit extends EventInit {
  hostname?: string;
  port: number;
  secure: boolean;
  serverType: "std" | "native" | "custom";
}

type ApplicationListenEventListenerOrEventListenerObject =
  | ApplicationListenEventListener
  | ApplicationListenEventListenerObject;

export interface ApplicationOptions<S> {
  /** An initial set of keys (or instance of `KeyGrip`) to be used for signing
   * cookies produced by the application. */
  keys?: KeyStack | Key[];

  /** If set to `true`, proxy headers will be trusted when processing requests.
   * This defaults to `false`. */
  proxy?: boolean;

  /** A server constructor to use instead of the default server for receiving
   * requests.
   * 
   * _This is not generally used, except for mocking and testing._
   */
  serverConstructor?: ServerConstructor<ServerRequest | NativeRequest>;

  /** The initial state object for the application, of which the type can be
   * used to infer the type of the state for both the application and any of the
   * application's context. */
  state?: S;
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

export class ApplicationErrorEvent<S extends State> extends ErrorEvent {
  context?: Context<S>;

  constructor(eventInitDict: ApplicationErrorEventInit<S>) {
    super("error", eventInitDict);
    this.context = eventInitDict.context;
  }
}

export class ApplicationListenEvent extends Event {
  hostname?: string;
  port: number;
  secure: boolean;
  serverType: "std" | "native" | "custom";

  constructor(eventInitDict: ApplicationListenEventInit) {
    super("listen", eventInitDict);
    this.hostname = eventInitDict.hostname;
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
  #composedMiddleware?: (context: Context<AS>) => Promise<void>;
  #keys?: KeyStack;
  #middleware: Middleware<State, Context<State>>[] = [];
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
    } = options;

    this.proxy = proxy ?? false;
    this.keys = keys;
    this.state = state ?? {} as AS;
    this.#serverConstructor = serverConstructor;
  }

  #getComposed = (): ((context: Context<AS>) => Promise<void>) => {
    if (!this.#composedMiddleware) {
      this.#composedMiddleware = compose(this.#middleware);
    }
    return this.#composedMiddleware;
  };

  /** Deal with uncaught errors in either the middleware or sending the
   * response. */
  // deno-lint-ignore no-explicit-any
  #handleError = (context: Context<AS>, error: any): void => {
    if (!(error instanceof Error)) {
      error = new Error(`non-error thrown: ${JSON.stringify(error)}`);
    }
    const { message } = error;
    this.dispatchEvent(new ApplicationErrorEvent({ context, message, error }));
    if (!context.response.writable) {
      return;
    }
    for (const key of context.response.headers.keys()) {
      context.response.headers.delete(key);
    }
    if (error.headers && error.headers instanceof Headers) {
      for (const [key, value] of error.headers) {
        context.response.headers.set(key, value);
      }
    }
    context.response.type = "text";
    const status: Status = context.response.status =
      error instanceof Deno.errors.NotFound
        ? 404
        : error.status && typeof error.status === "number"
        ? error.status
        : 500;
    context.response.body = error.expose
      ? error.message
      : STATUS_TEXT.get(status);
  };

  /** Processing registered middleware on each request. */
  #handleRequest = async (
    request: ServerRequest | NativeRequest,
    secure: boolean,
    state: RequestState,
  ): Promise<void> => {
    const context = new Context(this, request, secure);
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
    try {
      if (request instanceof NativeRequest) {
        closeResources = false;
        await request.respond(await context.response.toDomResponse());
      } else {
        await request.respond(await context.response.toServerResponse());
      }
      if (state.closing) {
        state.server.close();
        state.closed = true;
      }
    } catch (err) {
      this.#handleError(context, err);
    } finally {
      context.response.destroy(closeResources);
      resolve!();
      state.handling.delete(handlingPromise);
    }
  };

  /** Add an event listener for an `"error"` event which occurs when an
   * un-caught error occurs when processing the middleware or during processing
   * of the response. */
  addEventListener(
    type: "error",
    listener: ApplicationErrorEventListenerOrEventListenerObject<AS> | null,
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

  /** Handle an individual server request, returning the server response.  This
   * is similar to `.listen()`, but opening the connection and retrieving
   * requests are not the responsibility of the application.  If the generated
   * context gets set to not to respond, then the method resolves with
   * `undefined`, otherwise it resolves with a request that is compatible with
   * `std/http/server`. */
  handle = (async (
    request: ServerRequest | Request,
    secureOrConn: Deno.Conn<Deno.NetAddr> | boolean | undefined,
    secure = false,
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
      }, secureOrConn);
    } else {
      assert(
        typeof secureOrConn === "boolean" ||
          typeof secureOrConn === "undefined",
      );
      secure = secureOrConn ?? false;
      contextRequest = request;
    }
    const context = new Context(this, contextRequest, secure);
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
      // deno-lint-ignore no-unreachable
      this.#handleError(context, err);
      // deno-lint-ignore no-unreachable
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
    const { hostname, port, secure = false } = options;
    const serverType = server instanceof HttpServerStd
      ? "std"
      : server instanceof HttpServerNative
      ? "native"
      : "custom";
    this.dispatchEvent(
      new ApplicationListenEvent({ hostname, port, secure, serverType }),
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
    ...middleware: Middleware<S, Context<S>>[]
  ): Application<S extends AS ? S : (S & AS)> {
    this.#middleware.push(...middleware);
    this.#composedMiddleware = undefined;
    // deno-lint-ignore no-explicit-any
    return this as Application<any>;
  }
}
