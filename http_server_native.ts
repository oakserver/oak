// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import type { HttpConn, Listener, Server } from "./types.d.ts";
import { assert, isListenTlsOptions } from "./util.ts";

// this is included so when down-emitting to npm/Node.js, ReadableStream has
// async iterators
declare global {
  // deno-lint-ignore no-explicit-any
  interface ReadableStream<R = any> {
    [Symbol.asyncIterator](options?: {
      preventCancel?: boolean;
    }): AsyncIterableIterator<R>;
  }
}

export type Respond = (r: Response | Promise<Response>) => void;

// This type is part of Deno, but not part of lib.dom.d.ts, therefore add it here
// so that type checking can occur properly under `lib.dom.d.ts`.
interface ReadableStreamDefaultControllerCallback<R> {
  (controller: ReadableStreamDefaultController<R>): void | PromiseLike<void>;
}

const serveHttp: (conn: Deno.Conn) => HttpConn = "serveHttp" in Deno
  ? // deno-lint-ignore no-explicit-any
    (Deno as any).serveHttp.bind(Deno)
  : undefined;

/** The oak abstraction of the Deno native HTTP server which is used internally
 * for handling native HTTP requests. Generally users of oak do not need to
 * worry about this class. */
// deno-lint-ignore no-explicit-any
export class HttpServer<AS extends State = Record<string, any>>
  implements Server<NativeRequest> {
  #app: Application<AS>;
  #closed = false;
  #listener?: Deno.Listener;
  #httpConnections: Set<HttpConn> = new Set();
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

  listen(): Listener {
    return (this.#listener = isListenTlsOptions(this.#options)
      ? Deno.listenTls(this.#options)
      : Deno.listen(this.#options)) as Listener;
  }

  #trackHttpConnection(httpConn: HttpConn): void {
    this.#httpConnections.add(httpConn);
  }

  #untrackHttpConnection(httpConn: HttpConn): void {
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
            // if we await here, this becomes blocking, and really all we want
            // it to dispatch any errors that occur on the promise
            nativeRequest.donePromise.catch((error) => {
              server.app.dispatchEvent(new ErrorEvent("error", { error }));
            });
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
