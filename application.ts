// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/**
 * Contains the core concept of oak, the middleware application. Typical usage
 * is the creation of an application instance, registration of middleware, and
 * then starting to listen for requests.
 *
 * # Example
 *
 * ```ts
 * import { Application } from "jsr:@oak/oak@14/application";
 *
 * const app = new Application();
 * app.use((ctx) => {
 *   ctx.response.body = "hello world!";
 * });
 *
 * app.listen({ port: 8080 });
 * ```
 *
 * @module
 */

import { Context } from "./context.ts";
import { assert, KeyStack, type Status, STATUS_TEXT } from "./deps.ts";
import type { NativeRequest } from "./http_server_native_request.ts";
import {
  compose,
  isMiddlewareObject,
  type MiddlewareOrMiddlewareObject,
} from "./middleware.ts";
import { cloneState } from "./utils/clone_state.ts";
import { createPromiseWithResolvers } from "./utils/create_promise_with_resolvers.ts";
import type {
  Key,
  Listener,
  NetAddr,
  OakServer,
  ServerConstructor,
  ServerRequest,
} from "./types.ts";
import { isBun, isNetAddr, isNode } from "./utils/type_guards.ts";

/** Base interface for application listening options. */
export interface ListenOptionsBase {
  /** The port to listen on. If not specified, defaults to `0`, which allows the
   * operating system to determine the value. */
  port?: number;
  /** A literal IP address or host name that can be resolved to an IP address.
   * If not specified, defaults to `0.0.0.0`.
   *
   * __Note about `0.0.0.0`__ While listening `0.0.0.0` works on all platforms,
   * the browsers on Windows don't work with the address `0.0.0.0`.
   * You should show the message like `server running on localhost:8080` instead of
   * `server running on 0.0.0.0:8080` if your program supports Windows. */
  hostname?: string;
  secure?: false;
  /** An optional abort signal which can be used to close the listener. */
  signal?: AbortSignal;
}

interface TlsCertifiedKeyPem {
  /** The format of this key material, which must be PEM. */
  keyFormat?: "pem";
  /** Private key in `PEM` format. RSA, EC, and PKCS8-format keys are supported. */
  key: string;
  /** Certificate chain in `PEM` format. */
  cert: string;
}

interface TlsCertifiedKeyFromFile {
  /** Path to a file containing a PEM formatted CA certificate. Requires
   * `--allow-read`.
   *
   * @tags allow-read
   * @deprecated This will be removed in Deno 2.0. See the
   * {@link https://docs.deno.com/runtime/manual/advanced/migrate_deprecations | Deno 1.x to 2.x Migration Guide}
   * for migration instructions.
   */
  certFile: string;
  /** Path to a file containing a private key file. Requires `--allow-read`.
   *
   * @tags allow-read
   * @deprecated This will be removed in Deno 2.0. See the
   * {@link https://docs.deno.com/runtime/manual/advanced/migrate_deprecations | Deno 1.x to 2.x Migration Guide}
   * for migration instructions.
   */
  keyFile: string;
}

interface TlsCertifiedKeyConnectTls {
  /**
   * Certificate chain in `PEM` format.
   *
   * @deprecated This will be removed in Deno 2.0. See the
   * {@link https://docs.deno.com/runtime/manual/advanced/migrate_deprecations | Deno 1.x to 2.x Migration Guide}
   * for migration instructions.
   */
  certChain: string;
  /**
   * Private key in `PEM` format. RSA, EC, and PKCS8-format keys are supported.
   *
   * @deprecated This will be removed in Deno 2.0. See the
   * {@link https://docs.deno.com/runtime/manual/advanced/migrate_deprecations | Deno 1.x to 2.x Migration Guide}
   * for migration instructions.
   */
  privateKey: string;
}

type TlsCertifiedKeyOptions =
  | TlsCertifiedKeyPem
  | TlsCertifiedKeyFromFile
  | TlsCertifiedKeyConnectTls;

/** Interface options when listening on TLS. */
export type ListenOptionsTls = {
  /** The port to listen on. */
  port: number;
  /** A literal IP address or host name that can be resolved to an IP address.
   *
   * __Note about `0.0.0.0`__ While listening `0.0.0.0` works on all platforms,
   * the browsers on Windows don't work with the address `0.0.0.0`.
   * You should show the message like `server running on localhost:8080` instead of
   * `server running on 0.0.0.0:8080` if your program supports Windows.
   *
   * @default {"0.0.0.0"} */
  hostname?: string;

  transport?: "tcp";

  /** Application-Layer Protocol Negotiation (ALPN) protocols to announce to
   * the client. If not specified, no ALPN extension will be included in the
   * TLS handshake.
   */
  alpnProtocols?: string[];
  secure: true;
  /** An optional abort signal which can be used to close the listener. */
  signal?: AbortSignal;
} & TlsCertifiedKeyOptions;

interface HandleMethod {
  /** Handle an individual server request, returning the server response.  This
   * is similar to `.listen()`, but opening the connection and retrieving
   * requests are not the responsibility of the application.  If the generated
   * context gets set to not to respond, then the method resolves with
   * `undefined`, otherwise it resolves with a DOM `Response` object. */
  (
    request: Request,
    remoteAddr?: NetAddr,
    secure?: boolean,
  ): Promise<Response | undefined>;
}

interface CloudflareExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface CloudflareFetchHandler<
  Env extends Record<string, string> = Record<string, string>,
> {
  /** A method that is compatible with the Cloudflare Worker
   * [Fetch Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
   * and can be exported to handle Cloudflare Worker fetch requests.
   *
   * # Example
   *
   * ```ts
   * import { Application } from "@oak/oak";
   *
   * const app = new Application();
   * app.use((ctx) => {
   *   ctx.response.body = "hello world!";
   * });
   *
   * export default { fetch: app.fetch };
   * ```
   */
  (
    request: Request,
    env: Env,
    ctx: CloudflareExecutionContext,
  ): Promise<Response>;
}

/** Options which can be specified when listening. */
export type ListenOptions = ListenOptionsTls | ListenOptionsBase;

interface ApplicationCloseEventListener {
  (evt: ApplicationCloseEvent): void | Promise<void>;
}

interface ApplicationCloseEventListenerObject {
  handleEvent(evt: ApplicationCloseEvent): void | Promise<void>;
}

type ApplicationCloseEventListenerOrEventListenerObject =
  | ApplicationCloseEventListener
  | ApplicationCloseEventListenerObject;

interface ApplicationErrorEventListener<S extends AS, AS extends State> {
  (evt: ApplicationErrorEvent<S, AS>): void | Promise<void>;
}

interface ApplicationErrorEventListenerObject<S extends AS, AS extends State> {
  handleEvent(evt: ApplicationErrorEvent<S, AS>): void | Promise<void>;
}

interface ApplicationErrorEventInit<S extends AS, AS extends State>
  extends ErrorEventInit {
  context?: Context<S, AS>;
}

type ApplicationErrorEventListenerOrEventListenerObject<
  S extends AS,
  AS extends State,
> =
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
  listener: Listener;
  port: number;
  secure: boolean;
  serverType: "native" | "node" | "bun" | "custom";
}

type ApplicationListenEventListenerOrEventListenerObject =
  | ApplicationListenEventListener
  | ApplicationListenEventListenerObject;

/** Available options that are used when creating a new instance of
 * {@linkcode Application}. */
export interface ApplicationOptions<S extends State, R extends ServerRequest> {
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

  /** An optional replacer function to be used when serializing a JSON
   * response. The replacer will be used with `JSON.stringify()` to encode any
   * response bodies that need to be converted before sending the response.
   *
   * This is intended to allow responses to contain bigints and circular
   * references and encoding other values which JSON does not support directly.
   *
   * This can be used in conjunction with `jsonBodyReviver` to handle decoding
   * of request bodies if the same semantics are used for client requests.
   *
   * If more detailed or conditional usage is required, then serialization
   * should be implemented directly in middleware. */
  jsonBodyReplacer?: (
    key: string,
    value: unknown,
    context: Context<S>,
  ) => unknown;

  /** An optional reviver function to be used when parsing a JSON request. The
   * reviver will be used with `JSON.parse()` to decode any response bodies that
   * are being converted as JSON.
   *
   * This is intended to allow requests to deserialize to bigints, circular
   * references, or other values which JSON does not support directly.
   *
   * This can be used in conjunction with `jsonBodyReplacer` to handle decoding
   * of response bodies if the same semantics are used for responses.
   *
   * If more detailed or conditional usage is required, then deserialization
   * should be implemented directly in the middleware.
   */
  jsonBodyReviver?: (
    key: string,
    value: unknown,
    context: Context<S>,
  ) => unknown;

  /** An initial set of keys (or instance of {@linkcode KeyStack}) to be used for signing
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
   * requests.
   *
   * Generally this is only used for testing. */
  serverConstructor?: ServerConstructor<R>;

  /** The initial state object for the application, of which the type can be
   * used to infer the type of the state for both the application and any of the
   * application's context. */
  state?: S;
}

interface RequestState {
  handling: Set<Promise<void>>;
  closing: boolean;
  closed: boolean;
  server: OakServer<ServerRequest>;
}

/** The base type of state which is associated with an application or
 * context. */
// deno-lint-ignore no-explicit-any
export type State = Record<string | number | symbol, any>;

const ADDR_REGEXP = /^\[?([^\]]*)\]?:([0-9]{1,5})$/;

let DefaultServerCtor: ServerConstructor<ServerRequest> | undefined;
let NativeRequestCtor: typeof NativeRequest | undefined;

/** An event that occurs when the application closes. */
export class ApplicationCloseEvent extends Event {
  constructor(eventInitDict: EventInit) {
    super("close", eventInitDict);
  }
}

/** An event that occurs when an application error occurs.
 *
 * When the error occurs related to the handling of a request, the `.context`
 * property will be populated.
 */
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

/**
 * An event that occurs when the application starts listening for requests.
 */
export class ApplicationListenEvent extends Event {
  hostname: string;
  listener: Listener;
  port: number;
  secure: boolean;
  serverType: "native" | "node" | "bun" | "custom";

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
 * constructing an instance of `Application`. It can also be inferred by setting
 * the {@linkcode ApplicationOptions.state} option when constructing the
 * application.
 *
 * ### Basic example
 *
 * ```ts
 * import { Application } from "jsr:@oak/oak/application";
 *
 * const app = new Application();
 *
 * app.use((ctx, next) => {
 *   // called on each request with the context (`ctx`) of the request,
 *   // response, and other data.
 *   // `next()` is use to modify the flow control of the middleware stack.
 * });
 *
 * app.listen({ port: 8080 });
 * ```
 *
 * @template AS the type of the application state which extends
 *              {@linkcode State} and defaults to a simple string record.
 */
// deno-lint-ignore no-explicit-any
export class Application<AS extends State = Record<string, any>>
  extends EventTarget {
  #composedMiddleware?: (context: Context<AS, AS>) => Promise<unknown>;
  #contextOptions: Pick<
    ApplicationOptions<AS, ServerRequest>,
    "jsonBodyReplacer" | "jsonBodyReviver"
  >;
  #contextState: "clone" | "prototype" | "alias" | "empty";
  #keys?: KeyStack;
  #middleware: MiddlewareOrMiddlewareObject<State, Context<State, AS>>[] = [];
  #serverConstructor: ServerConstructor<ServerRequest> | undefined;

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

  constructor(options: ApplicationOptions<AS, ServerRequest> = {}) {
    super();
    const {
      state,
      keys,
      proxy,
      serverConstructor,
      contextState = "clone",
      logErrors = true,
      ...contextOptions
    } = options;

    this.proxy = proxy ?? false;
    this.keys = keys;
    this.state = state ?? {} as AS;
    this.#serverConstructor = serverConstructor;
    this.#contextOptions = contextOptions;
    this.#contextState = contextState;

    if (logErrors) {
      this.addEventListener("error", logErrorListener);
    }
  }

  #getComposed(): (context: Context<AS, AS>) => Promise<unknown> {
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
    if (!context.response.writable) {
      this.dispatchEvent(
        new ApplicationErrorEvent({ context, message, error }),
      );
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
      globalThis.Deno && Deno.errors && error instanceof Deno.errors.NotFound
        ? 404
        : error.status && typeof error.status === "number"
        ? error.status
        : 500;
    context.response.body = error.expose ? error.message : STATUS_TEXT[status];
    this.dispatchEvent(new ApplicationErrorEvent({ context, message, error }));
  }

  /** Processing registered middleware on each request. */
  async #handleRequest(
    request: ServerRequest,
    secure: boolean,
    state: RequestState,
  ): Promise<void> {
    let context: Context<AS, AS> | undefined;
    try {
      context = new Context(
        this,
        request,
        this.#getContextState(),
        { secure, ...this.#contextOptions },
      );
    } catch (e) {
      const error = e instanceof Error
        ? e
        : new Error(`non-error thrown: ${JSON.stringify(e)}`);
      const { message } = error;
      this.dispatchEvent(new ApplicationErrorEvent({ message, error }));
      return;
    }
    assert(context, "Context was not created.");
    const { promise, resolve } = createPromiseWithResolvers<void>();
    state.handling.add(promise);
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
      state.handling.delete(promise);
      return;
    }
    let closeResources = true;
    let response: Response;
    try {
      closeResources = false;
      response = await context.response.toDomResponse();
    } catch (err) {
      this.#handleError(context, err);
      response = await context.response.toDomResponse();
    }
    assert(response);
    try {
      await request.respond(response);
    } catch (err) {
      this.#handleError(context, err);
    } finally {
      context.response.destroy(closeResources);
      resolve!();
      state.handling.delete(promise);
      if (state.closing) {
        await state.server.close();
        if (!state.closed) {
          this.dispatchEvent(new ApplicationCloseEvent({}));
        }
        state.closed = true;
      }
    }
  }

  /** Add an event listener for a `"close"` event which occurs when the
   * application is closed and no longer listening or handling requests. */
  addEventListener<S extends AS>(
    type: "close",
    listener: ApplicationCloseEventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
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
    type: "close" | "error" | "listen",
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener, options);
  }

  /** A method that is compatible with the Cloudflare Worker
   * [Fetch Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
   * and can be exported to handle Cloudflare Worker fetch requests.
   *
   * # Example
   *
   * ```ts
   * import { Application } from "@oak/oak";
   *
   * const app = new Application();
   * app.use((ctx) => {
   *   ctx.response.body = "hello world!";
   * });
   *
   * export default { fetch: app.fetch };
   * ```
   */
  fetch: CloudflareFetchHandler = async <
    Env extends Record<string, string> = Record<string, string>,
  >(
    request: Request,
    _env: Env,
    _ctx: CloudflareExecutionContext,
  ): Promise<Response> => {
    if (!this.#middleware.length) {
      throw new TypeError("There is no middleware to process requests.");
    }
    if (!NativeRequestCtor) {
      const { NativeRequest } = await import("./http_server_native_request.ts");
      NativeRequestCtor = NativeRequest;
    }
    let remoteAddr: NetAddr | undefined;
    const hostname = request.headers.get("CF-Connecting-IP") ?? undefined;
    if (hostname) {
      remoteAddr = { hostname, port: 0, transport: "tcp" };
    }
    const contextRequest = new NativeRequestCtor(request, { remoteAddr });
    const context = new Context(
      this,
      contextRequest,
      this.#getContextState(),
      this.#contextOptions,
    );
    try {
      await this.#getComposed()(context);
      const response = await context.response.toDomResponse();
      context.response.destroy(false);
      return response;
    } catch (err) {
      this.#handleError(context, err);
      throw err;
    }
  };

  /** Handle an individual server request, returning the server response.  This
   * is similar to `.listen()`, but opening the connection and retrieving
   * requests are not the responsibility of the application.  If the generated
   * context gets set to not to respond, then the method resolves with
   * `undefined`, otherwise it resolves with a request that is compatible with
   * `std/http/server`. */
  handle: HandleMethod = (async (
    request: Request,
    secureOrAddr: NetAddr | boolean | undefined,
    secure: boolean | undefined = false,
  ): Promise<Response | undefined> => {
    if (!this.#middleware.length) {
      throw new TypeError("There is no middleware to process requests.");
    }
    assert(isNetAddr(secureOrAddr) || typeof secureOrAddr === "undefined");
    if (!NativeRequestCtor) {
      const { NativeRequest } = await import("./http_server_native_request.ts");
      NativeRequestCtor = NativeRequest;
    }
    const contextRequest = new NativeRequestCtor(request, {
      remoteAddr: secureOrAddr,
    });
    const context = new Context(
      this,
      contextRequest,
      this.#getContextState(),
      { secure, ...this.#contextOptions },
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
      const response = await context.response.toDomResponse();
      context.response.destroy(false);
      return response;
    } catch (err) {
      this.#handleError(context, err);
      throw err;
    }
  });

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
   * will be processed over HTTPS.
   *
   * Omitting options will default to `{ port: 0 }` which allows the operating
   * system to select the port. */
  async listen(options?: ListenOptions): Promise<void>;
  async listen(options: string | ListenOptions = { port: 0 }): Promise<void> {
    if (!this.#middleware.length) {
      throw new TypeError("There is no middleware to process requests.");
    }
    for (const middleware of this.#middleware) {
      if (isMiddlewareObject(middleware) && middleware.init) {
        await middleware.init();
      }
    }
    if (typeof options === "string") {
      const match = ADDR_REGEXP.exec(options);
      if (!match) {
        throw TypeError(`Invalid address passed: "${options}"`);
      }
      const [, hostname, portStr] = match;
      options = { hostname, port: parseInt(portStr, 10) };
    }
    options = Object.assign({ port: 0 }, options);
    if (!this.#serverConstructor) {
      if (!DefaultServerCtor) {
        const { Server } = await (isBun()
          ? import("./http_server_bun.ts")
          : isNode()
          ? import("./http_server_node.ts")
          : import("./http_server_native.ts"));
        DefaultServerCtor = Server as ServerConstructor<ServerRequest>;
      }
      this.#serverConstructor = DefaultServerCtor;
    }
    const server = new this.#serverConstructor(this, options);
    const state = {
      closed: false,
      closing: false,
      handling: new Set<Promise<void>>(),
      server,
    };
    const { signal } = options;
    if (signal) {
      signal.addEventListener("abort", () => {
        if (!state.handling.size) {
          state.closed = true;
          this.dispatchEvent(new ApplicationCloseEvent({}));
        }
        state.closing = true;
      }, { once: true });
    }
    const { secure = false } = options;
    const serverType = this.#serverConstructor.type ?? "custom";
    const listener = await server.listen();
    const { hostname, port } = listener.addr;
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
   * const import { Application } from "jsr:@oak/oak/application";
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
    middleware: MiddlewareOrMiddlewareObject<S, Context<S, AS>>,
    ...middlewares: MiddlewareOrMiddlewareObject<S, Context<S, AS>>[]
  ): Application<S extends AS ? S : (S & AS)>;
  use<S extends State = AS>(
    ...middleware: MiddlewareOrMiddlewareObject<S, Context<S, AS>>[]
  ): Application<S extends AS ? S : (S & AS)> {
    this.#middleware.push(...middleware);
    this.#composedMiddleware = undefined;
    // deno-lint-ignore no-explicit-any
    return this as Application<any>;
  }

  [Symbol.for("Deno.customInspect")](
    inspect: (value: unknown) => string,
  ): string {
    const { keys, proxy, state } = this;
    return `${this.constructor.name} ${
      inspect({ "#middleware": this.#middleware, keys, proxy, state })
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
    const { keys, proxy, state } = this;
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect(
        { "#middleware": this.#middleware, keys, proxy, state },
        newOptions,
      )
    }`;
  }
}
