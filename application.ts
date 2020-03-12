// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { Context } from "./context.ts";
import { compose, Middleware } from "./middleware.ts";
import { HTTPSOptions, serve, serveTLS, ServerRequest } from "./deps.ts";
/** A class which registers middleware (via `.use()`) and then processes
 * inbound requests against that middleware (via `.listen()`).
 *
 * The `context.state` can be typed via passing a generic argument when
 * constructing an instance of `Application`.
 */
export class Application<S extends object = { [key: string]: any }> {
  private _middleware: Middleware<S, Context<S>>[] = [];

  /** Generic state of the application, which can be specified by passing the
   * generic argument when constructing:
   *
   *       const app = new Application<{ foo: string }>();
   */
  state = {} as S;

  constructor(private _serve = serve, private _serveTLS = serveTLS) {}

  /** Processing registered middleware on each request. */
  private async _handleRequest(
    request: ServerRequest,
    middleware: (context: Context<S>) => Promise<void>
  ) {
    const context = new Context<S>(this, request);
    await middleware(context);
    await request.respond(context.response.toServerResponse());
  }

  /** Start listening for requests over HTTP, processing registered middleware
   * on each request. */
  async listen(addr: string | Deno.ListenOptions): Promise<void> {
    const middleware = compose<S, Context<S>>(this._middleware);
    const server = this._serve(addr);
    for await (const request of server) {
      this._handleRequest(request, middleware);
    }
  }

  /** Start listening for requests over HTTPS, processing registered middleware
   * on each request. */
  async listenTLS(options: HTTPSOptions): Promise<void> {
    const middleware = compose<S, Context<S>>(this._middleware);
    const server = this._serveTLS(options);
    for await (const request of server) {
      this._handleRequest(request, middleware);
    }
  }

  /** Register middleware to be used with the application. */
  use(...middleware: Middleware<S, Context<S>>[]): this {
    this._middleware.push(...middleware);
    return this;
  }
}
