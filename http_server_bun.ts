// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/** The abstraction that oak uses when dealing with requests and responses
 * within the Bun runtime that leverages the built in HTTP server.
 *
 * @module
 */

import type { Application } from "./application.ts";
import type {
  Listener,
  OakServer,
  ServeOptions,
  ServerRequest,
  ServeTlsOptions,
} from "./types.ts";
import { createPromiseWithResolvers } from "./utils/create_promise_with_resolvers.ts";

type TypedArray =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array
  | Uint8ClampedArray;
type BunFile = File;

interface Bun {
  serve(options: {
    fetch: (req: Request, server: BunServer) => Response | Promise<Response>;
    hostname?: string;
    port?: number;
    development?: boolean;
    error?: (error: Error) => Response | Promise<Response>;
    tls?: {
      key?:
        | string
        | TypedArray
        | BunFile
        | Array<string | TypedArray | BunFile>;
      cert?:
        | string
        | TypedArray
        | BunFile
        | Array<string | TypedArray | BunFile>;
      ca?: string | TypedArray | BunFile | Array<string | TypedArray | BunFile>;
      passphrase?: string;
      dhParamsFile?: string;
    };
    maxRequestBodySize?: number;
    lowMemoryMode?: boolean;
  }): BunServer;
}

interface BunServer {
  development: boolean;
  hostname: string;
  port: number;
  pendingRequests: number;
  requestIP(req: Request): SocketAddress | null;
  stop(): void;
  upgrade(req: Request, options?: {
    headers?: HeadersInit;
    //deno-lint-ignore no-explicit-any
    data?: any;
  }): boolean;
}

interface SocketAddress {
  address: string;
  port: number;
  family: "IPv4" | "IPv6";
}

declare const Bun: Bun;

function isServeTlsOptions(
  value: Omit<ServeOptions | ServeTlsOptions, "signal">,
): value is Omit<ServeTlsOptions, "signal"> {
  return !!("cert" in value && "key" in value);
}

class BunRequest implements ServerRequest {
  #hostname: string | undefined;
  // deno-lint-ignore no-explicit-any
  #reject: (reason?: any) => void;
  #request: Request;
  #resolve: (value: Response) => void;
  #resolved = false;
  #promise: Promise<Response>;

  get body(): ReadableStream<Uint8Array> | null {
    return this.#request.body;
  }

  get headers(): Headers {
    return this.#request.headers;
  }

  get method(): string {
    return this.#request.method;
  }

  get remoteAddr(): string | undefined {
    return this.#hostname;
  }

  get request(): Request {
    return this.#request;
  }

  get response(): Promise<Response> {
    return this.#promise;
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

  constructor(request: Request, server: BunServer) {
    this.#request = request;
    this.#hostname = server.requestIP(request)?.address;
    const { resolve, reject, promise } = createPromiseWithResolvers<Response>();
    this.#resolve = resolve;
    this.#reject = reject;
    this.#promise = promise;
  }

  // deno-lint-ignore no-explicit-any
  error(reason?: any): void {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#resolved = true;
    this.#reject(reason);
  }

  getBody(): ReadableStream<Uint8Array> | null {
    return this.#request.body;
  }

  respond(response: Response): void | Promise<void> {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#resolved = true;
    this.#resolve(response);
  }
}

/** An implementation of the oak server abstraction for handling requests on
 * Bun using the built in Bun http server. */
export class Server implements OakServer<BunRequest> {
  #options: ServeOptions | ServeTlsOptions;
  #server?: BunServer;
  #stream?: ReadableStream<BunRequest>;

  constructor(
    _app: Application,
    options: ServeOptions | ServeTlsOptions,
  ) {
    this.#options = options;
  }

  close(): void | Promise<void> {
    if (this.#server) {
      this.#server.stop();
    }
  }

  listen(): Listener | Promise<Listener> {
    if (this.#server) {
      throw new Error("Server already listening.");
    }
    const { onListen, hostname, port, signal } = this.#options;
    const tls = isServeTlsOptions(this.#options)
      ? { key: this.#options.key, cert: this.#options.cert }
      : undefined;
    const { promise, resolve } = createPromiseWithResolvers<Listener>();
    this.#stream = new ReadableStream<BunRequest>({
      start: (controller) => {
        this.#server = Bun.serve({
          fetch(req, server) {
            const request = new BunRequest(req, server);
            controller.enqueue(request);
            return request.response;
          },
          hostname,
          port,
          tls,
        });
        signal?.addEventListener("abort", () => {
          controller.close();
          this.close();
        }, { once: true });
        {
          const { hostname, port } = this.#server;
          if (onListen) {
            onListen({ hostname, port });
          }
          resolve({ addr: { hostname, port } });
        }
      },
    });
    return promise;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<BunRequest> {
    if (!this.#stream) {
      throw new TypeError("Server hasn't started listening.");
    }
    return this.#stream[Symbol.asyncIterator]();
  }

  static type: "bun" = "bun";
}
