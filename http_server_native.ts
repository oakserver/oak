// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/** The abstraction that oak uses when dealing with requests and responses
 * within the Deno runtime.
 *
 * @module
 */

import type { Application, State } from "./application.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import type {
  HttpServer,
  Listener,
  OakServer,
  ServeInit,
  ServeOptions,
  ServeTlsOptions,
} from "./types.ts";
import { createPromiseWithResolvers } from "./utils/create_promise_with_resolvers.ts";

const serve:
  | ((
    options: ServeInit & (ServeOptions | ServeTlsOptions),
  ) => HttpServer)
  | undefined = "Deno" in globalThis && "serve" in globalThis.Deno
    ? globalThis.Deno.serve.bind(globalThis.Deno)
    : undefined;

/** The oak abstraction of the Deno native HTTP server which is used internally
 * for handling native HTTP requests. Generally users of oak do not need to
 * worry about this class. */
// deno-lint-ignore no-explicit-any
export class Server<AS extends State = Record<string, any>>
  implements OakServer<NativeRequest> {
  #app: Application<AS>;
  #closed = false;
  #httpServer?: HttpServer;
  #options: ServeOptions | ServeTlsOptions;
  #stream?: ReadableStream<NativeRequest>;

  constructor(
    app: Application<AS>,
    options: Omit<ServeOptions | ServeTlsOptions, "signal">,
  ) {
    if (!serve) {
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

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }

    if (this.#httpServer) {
      this.#httpServer.unref();
      await this.#httpServer.shutdown();
      this.#httpServer = undefined;
    }
    this.#closed = true;
  }

  listen(): Promise<Listener> {
    if (this.#httpServer) {
      throw new Error("Server already listening.");
    }
    const { signal } = this.#options;
    const { onListen, ...options } = this.#options;
    const { promise, resolve } = createPromiseWithResolvers<Listener>();
    this.#stream = new ReadableStream<NativeRequest>({
      start: (controller) => {
        this.#httpServer = serve?.({
          handler: (req, info) => {
            const nativeRequest = new NativeRequest(req, info);
            controller.enqueue(nativeRequest);
            return nativeRequest.response;
          },
          onListen({ hostname, port }) {
            if (onListen) {
              onListen({ hostname, port });
            }
            resolve({ addr: { hostname, port } });
          },
          signal,
          ...options,
        });
      },
    });

    signal?.addEventListener("abort", () => this.close(), { once: true });
    return promise;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<NativeRequest> {
    if (!this.#stream) {
      throw new TypeError("Server hasn't started listening.");
    }
    return this.#stream[Symbol.asyncIterator]();
  }

  static type: "native" = "native";
}
