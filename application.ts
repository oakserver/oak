// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { Context } from "./context.ts";
import { compose, Middleware } from "./middleware.ts";
import { serve } from "./deps.ts";
import { Router, RouterOptions } from "./router.ts";

/** A class which registers middleware (via `.use()`) and then processes
 * inbound requests against that middleware (via `.listen()`).
 *
 * The `context.state` can be typed via passing a generic argument when
 * constructing an instance of `Application`.
 */
export class Application<S extends object = { [key: string]: any }> {
  private _middleware: Middleware<any, Context<any>>[] = [];
  private _serve: typeof serve;

  /** Generic state of the application, which can be specified by passing the
   * generic argument when constructing:
   *
   *       const app = new Application<{ foo: string }>();
   */
  state = {} as S;

  constructor(_serve = serve) {
    this._serve = _serve;
  }
  createRouter(options: RouterOptions = {}): Router<S> {
    return new Router<S>(options);
  }
  /** Start listening for requests, processing registered middleware on each
   * request.
   */
  async listen(addr: string): Promise<void> {
    const middleware = compose<S, Context<S>>(this._middleware);
    const server = this._serve(addr);
    for await (const request of server) {
      const context = new Context<S>(this, request);
      await middleware(context);
      await request.respond(context.response.toServerResponse());
    }
  }

  /** Register middleware to be used with the application. */
  use<NS extends {} = S>(middleware: Middleware<NS, Context<NS>>) {
    this._middleware.push(middleware);
    return (this as unknown) as Application<NS extends S ? NS : (S & NS)>;
  }
}
