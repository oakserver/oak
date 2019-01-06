import { Context } from "./context.ts";
import { compose, Middleware } from "./middleware.ts";
import { serve } from "./deps.ts";

export class Application<S extends object = { [key: string]: any }> {
  private _middleware: Middleware<Context<S>, S>[] = [];

  /** Start listening for requests, processing registered middleware on each
   * request.
   */
  async listen(addr: string): Promise<void> {
    const middleware = compose<Context<S>, S>(this._middleware);
    const server = serve(addr);
    for await (const request of server) {
      const context = new Context<S>(this, request);
      await middleware(context);
      await request.respond(context.response.toServerResponse());
    }
  }

  /** Register middleware to be used with the application. */
  use(...middleware: Middleware<Context<S>, S>[]): this {
    this._middleware.push(...middleware);
    return this;
  }
}
