import { Context } from "./context";
import { serve } from "./deps";

export interface Middleware {
  (context: Context, next: () => Promise<void>): Promise<void> | void;
}

function compose(
  middleware: Middleware[]
): (context: Context) => Promise<void> {
  return function(context: Context, next?: () => Promise<void>) {
    let index = -1;
    async function dispatch(i: number) {
      if (i <= index) {
        throw new Error("next() called multiple times.");
      }
      index = i;
      let fn: Middleware | undefined = middleware[i];
      if (i === middleware.length) {
        fn = next;
      }
      if (!fn) {
        return;
      }
      return fn(context, dispatch.bind(null, i + 1));
    }
    return dispatch(0);
  };
}

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

  use(middleware: Middleware): this {
    this._middleware.push(middleware);
    return this;
  }
}
