import { Context } from "./context.ts";

export interface Middleware<T extends Context = Context> {
  (context: T, next: () => Promise<void>): Promise<void> | void;
}

export function compose<T extends Context = Context>(
  middleware: Middleware<T>[]
): (context: T) => Promise<void> {
  return function composedMiddleware(context: T, next?: () => Promise<void>) {
    let index = -1;
    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error("next() called multiple times.");
      }
      index = i;
      let fn: Middleware<T> | undefined = middleware[i];
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
