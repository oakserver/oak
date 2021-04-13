// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { copyBytes } from "./deps.ts";
import { Server } from "./types.d.ts";
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

class BodyReader implements Deno.Reader {
  #buffer = new Uint8Array(0);
  #reader: ReadableStreamReader<Uint8Array> | null;

  constructor(body: ReadableStream<Uint8Array> | null) {
    this.#reader = body ? body.getReader() : null;
  }

  async read(p: Uint8Array): Promise<number | null> {
    if (!this.#reader) {
      return null;
    }
    let copied: number | null = null;
    if (this.#buffer.byteLength) {
      if (this.#buffer.byteLength > p.byteLength) {
        copied = copyBytes(this.#buffer.slice(0, p.byteLength - 1), p);
        this.#buffer = this.#buffer.slice(p.byteLength);
      } else {
        copied = copyBytes(this.#buffer, p);
        this.#buffer = new Uint8Array();
      }
      return copied;
    }
    const result = await this.#reader.read();
    if (result.value) {
      if (result.value.byteLength > p.byteLength) {
        copied = copyBytes(result.value.slice(0, p.byteLength - 1), p);
        this.#buffer = result.value.slice(p.byteLength);
      } else {
        copied = copyBytes(result.value, p);
      }
    }
    if (result.done) {
      this.#reader.releaseLock();
      this.#reader = null;
    }
    return copied;
  }
}

export class NativeRequest {
  #body: BodyReader;
  #conn: Deno.Conn;
  // deno-lint-ignore no-explicit-any
  #reject!: (reason?: any) => void;
  #request: Request;
  #requestPromise: Promise<void>;
  #resolve!: (value: Response) => void;
  #resolved = false;

  constructor(requestEvent: RequestEvent, conn: Deno.Conn) {
    this.#conn = conn;
    this.#request = requestEvent.request;
    this.#body = new BodyReader(requestEvent.request.body);
    const p = new Promise<Response>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
    this.#requestPromise = requestEvent.respondWith(p);
  }

  get body(): Deno.Reader {
    return this.#body;
  }

  get conn(): Deno.Conn {
    return this.#conn;
  }

  get headers(): Headers {
    return this.#request.headers;
  }

  get method(): string {
    return this.#request.method;
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

export class HttpServerNative implements Server<NativeRequest> {
  #closed = false;
  #options: Deno.ListenOptions | Deno.ListenTlsOptions;

  constructor(options: Deno.ListenOptions | Deno.ListenTlsOptions) {
    if (!("serveHttp" in Deno)) {
      throw new Error(
        "The native bindings for serving HTTP are not available.",
      );
    }
    this.#options = options;
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

        async function serve(conn: Deno.Conn) {
          const httpConn = serveHttp(conn);
          for await (const requestEvent of httpConn) {
            controller.enqueue(new NativeRequest(requestEvent, conn));
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
