// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import type { Listener, Server, ServerRequest } from "./types.d.ts";
import * as http from "http";

// There are quite a few differences between Deno's `std/node/http` and the
// typings for Node.js for `"http"`. Since we develop everything in Deno, but
// type check in Deno and Node.js we have to provide the API surface we depend
// on here, instead of accepting what comes in via the import.
export type IncomingMessage = {
  headers: Record<string, string>;
  method: string | null;
  socket: {
    address(): {
      addr: null | {
        address: string;
      };
    };
  };
  url: string | null;

  on(method: "data", listener: (chunk: Uint8Array) => void): void;
  on(method: "error", listener: (err: Error) => void): void;
  on(method: "end", listener: () => void): void;
};
type NodeHttpServer = {
  listen(options: { port: number; host: string; signal: AbortSignal }): void;
};
export type ServerResponse = {
  destroy(error?: Error): void;
  end(callback?: () => void): void;
  setHeader(key: string, value: string): void;
  write(chunk: unknown, callback?: (err: Error | null) => void): void;
  writeHead(status: number, statusText?: string): void;
};

interface ReadableStreamDefaultControllerCallback<R> {
  (controller: ReadableStreamDefaultController<R>): void | PromiseLike<void>;
}
// deno-lint-ignore no-explicit-any
interface ReadableStreamDefaultController<R = any> {
  readonly desiredSize: number | null;
  close(): void;
  enqueue(chunk: R): void;
  // deno-lint-ignore no-explicit-any
  error(error?: any): void;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  // deno-lint-ignore no-explicit-any
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export class NodeRequest implements ServerRequest {
  #request: IncomingMessage;
  #response: ServerResponse;
  #responded = false;

  get remoteAddr(): string | undefined {
    const addr = this.#request.socket.address();
    // deno-lint-ignore no-explicit-any
    return addr && (addr as any)?.address;
  }

  get headers(): Headers {
    return new Headers(this.#request.headers as Record<string, string>);
  }

  get method(): string {
    return this.#request.method ?? "GET";
  }

  get url(): string {
    return this.#request.url ?? "";
  }

  constructor(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    this.#request = request;
    this.#response = response;
  }

  // deno-lint-ignore no-explicit-any
  error(reason?: any) {
    if (this.#responded) {
      throw new Error("Request already responded to.");
    }
    let error;
    if (reason) {
      error = reason instanceof Error ? reason : new Error(String(reason));
    }
    this.#response.destroy(error);
    this.#responded = true;
  }

  getBody() {
    let body: ReadableStream<Uint8Array> | null;
    if (this.method === "GET" || this.method === "HEAD") {
      body = null;
    } else {
      body = new ReadableStream<Uint8Array>({
        start: (controller) => {
          this.#request.on("data", (chunk: Uint8Array) => {
            controller.enqueue(chunk);
          });
          this.#request.on("error", (err: Error) => {
            controller.error(err);
          });
          this.#request.on("end", () => {
            controller.close();
          });
        },
      });
    }
    return {
      body,
      async readBody() {
        if (!body) {
          return new Uint8Array();
        }
        const chunks: Uint8Array[] = [];
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        const totalLength = chunks.reduce(
          (acc, value) => acc + value.length,
          0,
        );
        const result = new Uint8Array(totalLength);
        let length = 0;
        for (const chunk of chunks) {
          result.set(chunk, length);
          length += chunk.length;
        }
        return result;
      },
    };
  }

  async respond(response: Response) {
    if (this.#responded) {
      throw new Error("Requested already responded to.");
    }
    for (const [key, value] of response.headers) {
      this.#response.setHeader(key, value);
    }
    this.#response.writeHead(response.status, response.statusText);
    if (response.body) {
      for await (const chunk of response.body) {
        const { promise, resolve, reject } = createDeferred<void>();
        // deno-lint-ignore no-explicit-any
        this.#response.write(chunk, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        await promise;
      }
    }
    const { promise, resolve } = createDeferred<void>();
    this.#response.end(resolve);
    await promise;
    this.#responded = true;
  }
}

export class HttpServer implements Server<NodeRequest> {
  #abortController = new AbortController();
  #host: string;
  #port: number;
  #requestStream: ReadableStream<NodeRequest>;
  #server!: NodeHttpServer;

  constructor(
    _app: unknown,
    options: Deno.ListenOptions | Deno.ListenTlsOptions,
  ) {
    this.#host = options.hostname ?? "127.0.0.1";
    this.#port = options.port;
    const start: ReadableStreamDefaultControllerCallback<NodeRequest> = (
      controller,
    ) => {
      const handler = (req: IncomingMessage, res: ServerResponse) =>
        controller.enqueue(new NodeRequest(req, res));
      // deno-lint-ignore no-explicit-any
      this.#server = http.createServer(handler as any);
    };
    this.#requestStream = new ReadableStream({ start });
  }

  close(): void {
    this.#abortController.abort();
  }

  listen(): Listener {
    this.#server.listen({
      port: this.#port,
      host: this.#host,
      signal: this.#abortController.signal,
    });
    return {
      addr: {
        port: this.#port,
        hostname: this.#host,
      },
    };
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<NodeRequest> {
    return this.#requestStream[Symbol.asyncIterator]();
  }
}
