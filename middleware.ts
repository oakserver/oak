// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { State } from "./application.ts";
import { Context } from "./context.ts";

/** Middleware are functions which are chained together to deal with requests. */
export interface Middleware<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
> {
  (context: T, next: () => Promise<void>): Promise<void> | void;
}

/** Compose multiple middleware functions into a single middleware function. */
export function compose<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
>(
  middleware: Middleware<S, T>[],
): (context: T, next?: () => Promise<void>) => Promise<void> {
  return function composedMiddleware(context: T, next?: () => Promise<void>) {
    let index = -1;

    function dispatch(i: number): Promise<void> {
      if (i <= index) {
        Promise.reject(new Error("next() called multiple times."));
      }
      index = i;
      let fn: Middleware<S, T> | undefined = middleware[i];
      if (i === middleware.length) {
        fn = next;
      }
      if (!fn) {
        return Promise.resolve();
      }
      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
