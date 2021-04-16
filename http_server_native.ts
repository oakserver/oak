// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";
import type { Server } from "./types.d.ts";
import { isListenTlsOptions } from "./util.ts";

export type Respond = (r: Response | Promise<Response>) => void;
export const DomResponse: typeof Response = Response;

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

/**
 * Detects if the current version of Deno provides the native HTTP bindings,
 * which may be only available under the `--unstable` flag.
 */
export function hasNativeHttp(): boolean {
  return !!serveHttp;
}

export class NativeRequest {
  #conn?: Deno.Conn<Deno.NetAddr>;
  // deno-lint-ignore no-explicit-any
  #reject!: (reason?: any) => void;
  #request: Request;
  #requestPromise: Promise<void>;
  #resolve!: (value: Response) => void;
  #resolved = false;

  constructor(requestEvent: RequestEvent, conn?: Deno.Conn<Deno.NetAddr>) {
    this.#conn = conn;
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
    return this.#conn?.remoteAddr.hostname;
  }

  get request(): Request {
    return this.#request;
  }

  get url(): string {
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
}

// deno-lint-ignore no-explicit-any
export class HttpServerNative<AS extends State = Record<string, any>>
  implements Server<NativeRequest> {
  #app: Application<AS>;
  #closed = false;
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
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<NativeRequest> {
    // deno-lint-ignore no-this-alias
    const server = this;
    const options = this.#options;

    const stream = new ReadableStream<NativeRequest>({
      start(controller) {
        const listener = isListenTlsOptions(options)
          ? Deno.listenTls(options)
          : Deno.listen(options);

        async function serve(conn: Deno.Conn<Deno.NetAddr>) {
          const httpConn = serveHttp(conn);
          for await (const requestEvent of httpConn) {
            const nativeRequest = new NativeRequest(requestEvent, conn);
            controller.enqueue(nativeRequest);
            try {
              await nativeRequest.donePromise;
            } catch (error) {
              server.app.dispatchEvent(new ErrorEvent("error", { error }));
            }
            if (server.closed) {
              httpConn.close();
              listener.close();
              controller.close();
              return;
            }
          }
        }

        async function accept() {
          for await (const conn of listener) {
            if (server.closed) {
              listener.close();
              controller.close();
              return;
            }
            serve(conn);
          }
        }

        accept();
      },
    });

    return stream[Symbol.asyncIterator]();
  }
}
