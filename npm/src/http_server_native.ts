import * as denoShim from "deno.ns";
// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.js";
import type { Server, UpgradeWebSocketOptions } from "./types.d.js";
import { assert, isListenTlsOptions } from "./util.js";

export type Respond = (r: denoShim.Response | Promise<denoShim.Response>) => void;
export const DomResponse: typeof denoShim.Response = denoShim.Response;

// This type is part of Deno, but not part of lib.dom.d.ts, therefore add it here
// so that type checking can occur properly under `lib.dom.d.ts`.
interface ReadableStreamDefaultControllerCallback<R> {
  (controller: ReadableStreamDefaultController<R>): void | PromiseLike<void>;
}

// Since the native bindings are currently unstable in Deno, we will add the
// interfaces here, so that we can type check oak without requiring the
// `--unstable` flag to be used.

interface RequestEvent {
  readonly request: denoShim.Request;
  respondWith(r: denoShim.Response | Promise<denoShim.Response>): Promise<void>;
}

interface HttpConn extends AsyncIterable<RequestEvent> {
  readonly rid: number;
  nextRequest(): Promise<RequestEvent | null>;
  close(): void;
}

const serveHttp: (conn: denoShim.Deno.Conn) => HttpConn = "serveHttp" in Deno
  ? // deno-lint-ignore no-explicit-any
    (denoShim.Deno as any).serveHttp.bind(
      denoShim.Deno,
    )
  : undefined;

interface WebSocketUpgrade {
  response: denoShim.Response;
  socket: WebSocket;
}

export type UpgradeWebSocketFn = (
  request: denoShim.Request,
  options?: UpgradeWebSocketOptions,
) => WebSocketUpgrade;

const maybeUpgradeWebSocket: UpgradeWebSocketFn | undefined =
  "upgradeWebSocket" in Deno
    ? // deno-lint-ignore no-explicit-any
      (denoShim.Deno as any).upgradeWebSocket.bind(denoShim.Deno)
    : undefined;

export interface NativeRequestOptions {
  conn?: denoShim.Deno.Conn;
  upgradeWebSocket?: UpgradeWebSocketFn;
}

export class NativeRequest {
  #conn?: denoShim.Deno.Conn;
  // deno-lint-ignore no-explicit-any
  #reject!: (reason?: any) => void;
  #request: denoShim.Request;
  #requestPromise: Promise<void>;
  #resolve!: (value: denoShim.Response) => void;
  #resolved = false;
  #upgradeWebSocket?: UpgradeWebSocketFn;

  constructor(
    requestEvent: RequestEvent,
    options: NativeRequestOptions = {},
  ) {
    const { conn } = options;
    this.#conn = conn;
    // this allows for the value to be explicitly undefined in the options
    this.#upgradeWebSocket = "upgradeWebSocket" in options
      ? options["upgradeWebSocket"]
      : maybeUpgradeWebSocket;
    this.#request = requestEvent.request;
    const p = new Promise<denoShim.Response>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
    this.#requestPromise = requestEvent.respondWith(p);
  }

  get body(): ReadableStream<Uint8Array> | null {
    return this.#request.body;
  }

  get donePromise(): Promise<void> {
    return this.#requestPromise;
  }

  get headers(): denoShim.Headers {
    return this.#request.headers;
  }

  get method(): string {
    return this.#request.method;
  }

  get remoteAddr(): string | undefined {
    return (this.#conn?.remoteAddr as denoShim.Deno.NetAddr)?.hostname;
  }

  get request(): denoShim.Request {
    return this.#request;
  }

  get url(): string {
    try {
      const url = new URL(this.#request.url);
      return this.#request.url.replace(url.origin, "");
    } catch {
      // we don't care about errors, we just want to fall back
    }
    return this.#request.url;
  }

  get rawUrl(): string {
    return this.#request.url;
  }

  // deno-lint-ignore no-explicit-any
  error(reason?: any): void {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#reject(reason);
    this.#resolved = true;
  }

  respond(response: denoShim.Response): Promise<void> {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#resolve(response);
    this.#resolved = true;
    return this.#requestPromise;
  }

  upgrade(options?: UpgradeWebSocketOptions): WebSocket {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    if (!this.#upgradeWebSocket) {
      throw new TypeError("Upgrading web sockets not supported.");
    }
    const { response, socket } = this.#upgradeWebSocket(
      this.#request,
      options,
    );
    this.#resolve(response);
    this.#resolved = true;
    return socket;
  }
}

// deno-lint-ignore no-explicit-any
export class HttpServerNative<AS extends State = Record<string, any>>
  implements Server<NativeRequest> {
  #app: Application<AS>;
  #closed = false;
  #listener?: denoShim.Deno.Listener;
  #httpConnections: Set<denoShim.Deno.HttpConn> = new Set();
  #options: denoShim.Deno.ListenOptions | denoShim.Deno.ListenTlsOptions;

  constructor(
    app: Application<AS>,
    options: denoShim.Deno.ListenOptions | denoShim.Deno.ListenTlsOptions,
  ) {
    if (!("serveHttp" in Deno)) {
      throw new Error(
        "The native bindings for serving HTTP are not available.",
      );
    }
    this.#app = app;
    this.#options = options;
  }

  get app(): Application<AS> {
    return this.#app;
  }

  get closed(): boolean {
    return this.#closed;
  }

  close(): void {
    this.#closed = true;

    if (this.#listener) {
      this.#listener.close();
      this.#listener = undefined;
    }

    for (const httpConn of this.#httpConnections) {
      try {
        httpConn.close();
      } catch (error) {
        if (!(error instanceof denoShim.Deno.errors.BadResource)) {
          throw error;
        }
      }
    }

    this.#httpConnections.clear();
  }

  listen(): denoShim.Deno.Listener {
    return this.#listener = isListenTlsOptions(this.#options)
      ? denoShim.Deno.listenTls(this.#options)
      : denoShim.Deno.listen(this.#options);
  }

  #trackHttpConnection(httpConn: denoShim.Deno.HttpConn): void {
    this.#httpConnections.add(httpConn);
  }

  #untrackHttpConnection(httpConn: denoShim.Deno.HttpConn): void {
    this.#httpConnections.delete(httpConn);
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<NativeRequest> {
    const start: ReadableStreamDefaultControllerCallback<NativeRequest> = (
      controller,
    ) => {
      // deno-lint-ignore no-this-alias
      const server = this;
      async function serve(conn: denoShim.Deno.Conn) {
        const httpConn = serveHttp(conn);
        server.#trackHttpConnection(httpConn);

        while (true) {
          try {
            const requestEvent = await httpConn.nextRequest();

            if (requestEvent === null) {
              return;
            }

            const nativeRequest = new NativeRequest(requestEvent, { conn });
            controller.enqueue(nativeRequest);
            await nativeRequest.donePromise;
          } catch (error) {
            server.app.dispatchEvent(new ErrorEvent("error", { error }));
          }

          if (server.closed) {
            server.#untrackHttpConnection(httpConn);
            httpConn.close();
            controller.close();
          }
        }
      }

      const listener = this.#listener;
      assert(listener);
      async function accept() {
        while (true) {
          try {
            const conn = await listener!.accept();
            serve(conn);
          } catch (error) {
            if (!server.closed) {
              server.app.dispatchEvent(new ErrorEvent("error", { error }));
            }
          }
          if (server.closed) {
            controller.close();
            return;
          }
        }
      }

      accept();
    };
    const stream = new ReadableStream<NativeRequest>({ start });

    return stream[Symbol.asyncIterator]();
  }
}
