// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Context } from "./context.ts";
import { compose, Middleware } from "./middleware.ts";
import {
  HTTPSOptions,
  serve as defaultServe,
  serveTLS as defaultServeTls,
  ServerRequest,
} from "./deps.ts";
/** A class which registers middleware (via `.use()`) and then processes
 * inbound requests against that middleware (via `.listen()`).
 *
 * The `context.state` can be typed via passing a generic argument when
 * constructing an instance of `Application`.
 */
export class Application<
  S extends Record<string | number | symbol, any> = Record<string, any>,
> {
  #middleware: Middleware<S, Context<S>>[] = [];
  #serve: typeof defaultServe;
  #serveTls: typeof defaultServeTls;

  /** Generic state of the application, which can be specified by passing the
   * generic argument when constructing:
   *
   *       const app = new Application<{ foo: string }>();
   */
  state = {} as S;

  constructor(serve = defaultServe, serveTls = defaultServeTls) {
    // These are just here to make mocking easy, versus being intended as part
    // of normal usage of this class.
    this.#serve = serve;
    this.#serveTls = serveTls;
  }

  /** Processing registered middleware on each request. */
  #handleRequest = async (
    request: ServerRequest,
    middleware: (context: Context<S>) => Promise<void>,
  ) => {
    const context = new Context<S>(this, request);
    await middleware(context);
    await request.respond(context.response.toServerResponse());
  };

  /** Start listening for requests over HTTP, processing registered middleware
   * on each request. */
  async listen(addr: string | Deno.ListenOptions): Promise<void> {
    const middleware = compose<S, Context<S>>(this.#middleware);
    const server = this.#serve(addr);
    for await (const request of server) {
      this.#handleRequest(request, middleware);
    }
  }

  /** Start listening for requests over HTTPS, processing registered middleware
   * on each request. */
  async listenTLS(options: HTTPSOptions): Promise<void> {
    const middleware = compose<S, Context<S>>(this.#middleware);
    const server = this.#serveTls(options);
    for await (const request of server) {
      this.#handleRequest(request, middleware);
    }
  }

  /** Register middleware to be used with the application. */
  use(...middleware: Middleware<S, Context<S>>[]): this {
    this.#middleware.push(...middleware);
    return this;
  }
}
