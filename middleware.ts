// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { Context } from "./context.ts";

/** Middleware are functions which are chained together to deal with requests. */
export interface Middleware<
  T extends Context = Context<S>,
  S extends object = { [key: string]: any }
> {
  (context: T, next: () => Promise<void>): Promise<void> | void;
}

/** Compose multiple middleware functions into a single middleware function. */
export function compose<
  T extends Context = Context<S>,
  S extends object = { [key: string]: any }
>(middleware: Middleware<T>[]): (context: T) => Promise<void> {
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
