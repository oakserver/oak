// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Context } from "./context.ts";
import {
  serve as defaultServe,
  serveTLS as defaultServeTls,
  ServerRequest,
  Status,
  STATUS_TEXT,
} from "./deps.ts";
import { Key, KeyStack } from "./keyStack.ts";
import { compose, Middleware } from "./middleware.ts";
import { Server } from "https://deno.land/std@0.51.0/http/server.ts";
export interface ListenOptionsBase {
  hostname?: string;
  port: number;
  secure?: false;
  signal?: AbortSignal;
}

export interface ListenOptionsTls {
  certFile: string;
  hostname?: string;
  keyFile: string;
  port: number;
  secure: true;
  signal?: AbortSignal;
}

export type ListenOptions = ListenOptionsTls | ListenOptionsBase;

function isOptionsTls(options: ListenOptions): options is ListenOptionsTls {
  return options.secure === true;
}

interface ApplicationErrorEventListener<S> {
  (evt: ApplicationErrorEvent<S>): void | Promise<void>;
}

interface ApplicationErrorEventListenerObject<S> {
  handleEvent(evt: ApplicationErrorEvent<S>): void | Promise<void>;
}

export interface ApplicationErrorEventInit<S extends State>
  extends ErrorEventInit {
  context?: Context<S>;
}

type ApplicationErrorEventListenerOrEventListenerObject<S> =
  | ApplicationErrorEventListener<S>
  | ApplicationErrorEventListenerObject<S>;

export interface ApplicationOptions<S> {
  /** An initial set of keys (or instance of `KeyGrip`) to be used for signing
   * cookies produced by the application. */
  keys?: KeyStack | Key[];

  /** The `server()` function to be used to read requests.
   * 
   * _Not used generally, as this is just for mocking for test purposes_ */
  serve?: typeof defaultServe;

  /** The `server()` function to be used to read requests.
   * 
   * _Not used generally, as this is just for mocking for test purposes_ */
  serveTls?: typeof defaultServeTls;

  /** The initial state object for the application, of which the type can be
   * used to infer the type of the state for both the application and any of the
   * application's context. */
  state?: S;
}

export type State = Record<string | number | symbol, any>;

const ADDR_REGEXP = /^\[?([^\]]*)\]?:([0-9]{1,5})$/;

export class ApplicationErrorEvent<S extends State> extends ErrorEvent {
  context?: Context<S>;

  constructor(type: string, eventInitDict: ApplicationErrorEventInit<S>) {
    super(type, eventInitDict);
    this.context = eventInitDict.context;
  }
}

/** A class which registers middleware (via `.use()`) and then processes
 * inbound requests against that middleware (via `.listen()`).
 *
 * The `context.state` can be typed via passing a generic argument when
 * constructing an instance of `Application`.
 */
export class Application<S extends State = Record<string, any>>
  extends EventTarget {
  #keys?: KeyStack;
  #middleware: Middleware<S, Context<S>>[] = [];
  #serve: typeof defaultServe;
  #serveTls: typeof defaultServeTls;

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

  /** Generic state of the application, which can be specified by passing the
   * generic argument when constructing:
   *
   *       const app = new Application<{ foo: string }>();
   * 
   * Or can be contextually inferred based on setting an initial state object:
   * 
   *       const app = new Application({ state: { foo: "bar" } });
   * 
   */
  state: S;

  constructor(options: ApplicationOptions<S> = {}) {
    super();
    const {
      state,
      keys,
      serve = defaultServe,
      serveTls = defaultServeTls,
    } = options;

    this.keys = keys;
    this.state = state ?? {} as S;
    this.#serve = serve;
    this.#serveTls = serveTls;
  }

  /** Deal with uncaught errors in either the middleware or sending the
   * response. */
  #handleError = (context: Context<S>, error: any): void => {
    if (!(error instanceof Error)) {
      error = new Error(`non-error thrown: ${JSON.stringify(error)}`);
    }
    const { message } = error;
    this.dispatchEvent(
      new ApplicationErrorEvent("error", { context, message, error }),
    );
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
  #handleRequest = async (request: ServerRequest, state: {
    closed: boolean;
    middleware: (context: Context<S>) => Promise<void>;
    server: Server;
  }) => {
    const context = new Context(this, request);
    if (!state.closed) {
      try {
        await state.middleware(context);
      } catch (err) {
        this.#handleError(context, err);
      }
    }
    try {
      await request.respond(context.response.toServerResponse());
      if (state.closed) {
        state.server.close();
      }
    } catch (err) {
      this.#handleError(context, err);
    }
  };

  addEventListener(
    type: "error",
    listener: ApplicationErrorEventListenerOrEventListenerObject<S> | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener, options);
  }

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
    if (typeof options === "string") {
      const match = ADDR_REGEXP.exec(options);
      if (!match) {
        throw TypeError(`Invalid address passed: "${options}"`);
      }
      const [, hostname, portStr] = match;
      options = { hostname, port: parseInt(portStr, 10) };
    }
    const middleware = compose(this.#middleware);
    const server = isOptionsTls(options)
      ? this.#serveTls(options)
      : this.#serve(options);
    const { signal } = options;
    const state = { closed: false, middleware, server };
    if (signal) {
      signal.addEventListener("abort", () => state.closed = true);
    }
    try {
      for await (const request of server) {
        this.#handleRequest(request, state);
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Application Error";
      this.dispatchEvent(
        new ApplicationErrorEvent("error", { message, error }),
      );
    }
  }

  /** Register middleware to be used with the application. */
  use(...middleware: Middleware<S, Context<S>>[]): this {
    this.#middleware.push(...middleware);
    return this;
  }
}
