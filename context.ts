// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Application, State } from "./application.ts";
import { Cookies } from "./cookies.ts";
import {
  acceptable,
  acceptWebSocket,
  ServerRequest,
  WebSocket,
} from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import { KeyStack } from "./keyStack.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { send, SendOptions } from "./send.ts";
import { ErrorStatus } from "./types.d.ts";

export interface ContextSendOptions extends SendOptions {
  /** The filename to send, which will be resolved based on the other options.
   * If this property is omitted, the current context's `.request.url.pathname`
   * will be used. */
  path?: string;
}

/** Provides context about the current request and response to middleware
 * functions. */
export class Context<S extends State = Record<string, any>> {
  #socket?: WebSocket;

  /** A reference to the current application. */
  app: Application<State>;

  /** An object which allows access to cookies, mediating both the request and
   * response. */
  cookies: Cookies;

  /** Is `true` if the current connection is upgradeable to a web socket.
   * Otherwise the value is `false`.  Use `.upgrade()` to upgrade the connection
   * and return the web socket. */
  get isUpgradable(): boolean {
    return acceptable(this.request);
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
   * with the web socket, otherwise it is `undefined`. */
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
   */
  state: S;

  constructor(app: Application<S>, serverRequest: ServerRequest) {
    this.app = app;
    this.state = app.state;
    this.request = new Request(serverRequest);
    this.respond = true;
    this.response = new Response(this.request);
    this.cookies = new Cookies(this.request, this.response, {
      keys: this.app.keys as KeyStack | undefined,
      secure: this.request.secure,
    });
  }

  /** Asserts the condition and if the condition fails, creates an HTTP error
   * with the provided status (which defaults to `500`).  The error status by 
   * default will be set on the `.response.status`.
   */
  assert(
    condition: any,
    errorStatus: ErrorStatus = 500,
    message?: string,
    props?: object,
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

  /** Create and throw an HTTP Error, which can be used to pass status
   * information which can be caught by other middleware to send more
   * meaningful error messages back to the client.  The passed error status will
   * be set on the `.response.status` by default as well.
   */
  throw(errorStatus: ErrorStatus, message?: string, props?: object): never {
    const err = createHttpError(errorStatus, message);
    if (props) {
      Object.assign(err, props);
    }
    throw err;
  }

  /** Take the current request and upgrade it to a web socket, resolving with
   * the web socket object. This will set `.respond` to `false`. */
  async upgrade(): Promise<WebSocket> {
    if (this.#socket) {
      return this.#socket;
    }
    const { conn, r: bufReader, w: bufWriter, headers } =
      this.request.serverRequest;
    this.#socket = await acceptWebSocket(
      { conn, bufReader, bufWriter, headers },
    );
    this.respond = false;
    return this.#socket;
  }
}
