import { Context } from "./context.ts";
import { compose, Middleware } from "./middleware.ts";
import { serve } from "./deps.ts";

export class Application {
  private _middleware: Middleware[] = [];

  async listen(addr: string): Promise<void> {
    const middleware = compose(this._middleware);
    const server = serve(addr);
    for await (const request of server) {
      const context = new Context(request);
      await middleware(context);
      await request.respond(context.response.toServerResponse());
    }
  }

  use(...middleware: Middleware[]): this {
    this._middleware.push(...middleware);
    return this;
  }
}
