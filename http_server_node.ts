// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/** The abstraction that oak uses when dealing with requests and responses
 * within the Node.js runtime.
 *
 * @module
 */

import type {
  Listener,
  OakServer,
  ServeOptions,
  ServerRequest,
  ServeTlsOptions,
} from "./types.ts";
import { createPromiseWithResolvers } from "./utils/create_promise_with_resolvers.ts";

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

  getBody(): ReadableStream<Uint8Array> | null {
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
    return body;
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
        const { promise, resolve, reject } = createPromiseWithResolvers<void>();
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
    const { promise, resolve } = createPromiseWithResolvers<void>();
    this.#response.end(resolve);
    await promise;
    this.#responded = true;
  }
}

export class Server implements OakServer<NodeRequest> {
  #abortController = new AbortController();
  #host: string;
  #port: number;
  #requestStream: ReadableStream<NodeRequest> | undefined;

  constructor(
    _app: unknown,
    options: ServeOptions | ServeTlsOptions,
  ) {
    this.#host = options.hostname ?? "127.0.0.1";
    this.#port = options.port ?? 80;
    options.signal?.addEventListener("abort", () => {
      this.close();
    }, { once: true });
  }

  close(): void {
    this.#abortController.abort();
  }

  async listen(): Promise<Listener> {
    const { createServer } = await import("node:http");
    let server: NodeHttpServer;
    this.#requestStream = new ReadableStream({
      start: (controller) => {
        server = createServer((req, res) => {
          // deno-lint-ignore no-explicit-any
          controller.enqueue(new NodeRequest(req as any, res as any));
        });
        this.#abortController.signal.addEventListener(
          "abort",
          () => controller.close(),
          { once: true },
        );
      },
    });
    server!.listen({
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
    if (!this.#requestStream) {
      throw new TypeError("stream not properly initialized");
    }
    return this.#requestStream[Symbol.asyncIterator]();
  }

  static type: "node" = "node";
}
