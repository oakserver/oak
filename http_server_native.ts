// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";
import type { Server, UpgradeWebSocketOptions } from "./types.d.ts";
import { assert, isListenTlsOptions } from "./util.ts";

export type Respond = (r: Response | Promise<Response>) => void;
export const DomResponse: typeof Response = Response;

// This type is part of Deno, but not part of lib.dom.d.ts, therefore add it here
// so that type checking can occur properly under `lib.dom.d.ts`.
interface ReadableStreamDefaultControllerCallback<R> {
  (controller: ReadableStreamDefaultController<R>): void | PromiseLike<void>;
}

// Since the native bindings are currently unstable in Deno, we will add the
// interfaces here, so that we can type check oak without requiring the
// `--unstable` flag to be used.

interface RequestEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): Promise<void>;
}

interface HttpConn extends AsyncIterable<RequestEvent> {
  readonly rid: number;
  nextRequest(): Promise<RequestEvent | null>;
  close(): void;
}

const serveHttp: (conn: Deno.Conn) => HttpConn = "serveHttp" in Deno
  ? // deno-lint-ignore no-explicit-any
    (Deno as any).serveHttp.bind(
      Deno,
    )
  : undefined;

interface WebSocketUpgrade {
  response: Response;
  socket: WebSocket;
}

export type UpgradeWebSocketFn = (
  request: Request,
  options?: UpgradeWebSocketOptions,
) => WebSocketUpgrade;

const maybeUpgradeWebSocket: UpgradeWebSocketFn | undefined =
  "upgradeWebSocket" in Deno
    ? // deno-lint-ignore no-explicit-any
      (Deno as any).upgradeWebSocket.bind(Deno)
    : undefined;

export interface NativeRequestOptions {
  conn?: Deno.Conn;
  upgradeWebSocket?: UpgradeWebSocketFn;
}

export class NativeRequest {
  #conn?: Deno.Conn;
  // deno-lint-ignore no-explicit-any
  #reject!: (reason?: any) => void;
  #request: Request;
  #requestPromise: Promise<void>;
  #resolve!: (value: Response) => void;
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
    const p = new Promise<Response>((resolve, reject) => {
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

  get headers(): Headers {
    return this.#request.headers;
  }

  get method(): string {
    return this.#request.method;
  }

  get remoteAddr(): string | undefined {
    return (this.#conn?.remoteAddr as Deno.NetAddr)?.hostname;
  }

  get request(): Request {
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

  respond(response: Response): Promise<void> {
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
  #listener?: Deno.Listener;
  #httpConnections: Set<Deno.HttpConn> = new Set();
  #options: Deno.ListenOptions | Deno.ListenTlsOptions;

  constructor(
    app: Application<AS>,
    options: Deno.ListenOptions | Deno.ListenTlsOptions,
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
        if (!(error instanceof Deno.errors.BadResource)) {
          throw error;
        }
      }
    }

    this.#httpConnections.clear();
  }

  listen(): Deno.Listener {
    return this.#listener = isListenTlsOptions(this.#options)
      ? Deno.listenTls(this.#options)
      : Deno.listen(this.#options);
  }

  #trackHttpConnection(httpConn: Deno.HttpConn): void {
    this.#httpConnections.add(httpConn);
  }

  #untrackHttpConnection(httpConn: Deno.HttpConn): void {
    this.#httpConnections.delete(httpConn);
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<NativeRequest> {
    const start: ReadableStreamDefaultControllerCallback<NativeRequest> = (
      controller,
    ) => {
      // deno-lint-ignore no-this-alias
      const server = this;
      async function serve(conn: Deno.Conn) {
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
