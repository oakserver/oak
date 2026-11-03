// Copyright 2018-2025 the oak authors. All rights reserved. MIT license.

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
    const { onListen, signal: _signal, ...options } = this.#options;
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
          // Intentionally not passing `signal` here. Deno's native server
          // treats an aborted signal as a hard stop, tearing down in-flight
          // connections immediately rather than letting them finish. oak's
          // own `Application#listen()` already tracks in-flight requests
          // and calls `Server#close()` (which calls `shutdown()` below)
          // only once they've drained, so handling the abort ourselves
          // (instead of handing `signal` to `serve()`) lets in-flight
          // requests complete normally before the server actually stops.
          ...options,
        });
        this.#httpServer?.finished.then(() => {
          try {
            controller.close();
          } catch {
            // The controller may already be closed or errored; ignore.
          }
        });
      },
    });

    // Note: we deliberately do not close the server here when `signal`
    // aborts. `Application#listen()` already listens for `signal`'s abort
    // event itself and calls `Server#close()` only after all in-flight
    // requests (tracked in its own `state.handling`) have finished. Closing
    // the server immediately on abort here would race that drain and cut
    // off in-flight requests, which is the behavior this is meant to avoid.
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
