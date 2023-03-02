// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import type { State } from "./application.ts";
import type { Context } from "./context.ts";

/** Middleware are functions which are chained together to deal with requests. */
export interface Middleware<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
> {
  (context: T, next: () => Promise<unknown>): Promise<unknown> | unknown;
}

/** Middleware can also be objects to encapsulate more logic and state. */
export interface MiddlewareObject<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
> {
  /** Optional function for delayed initialization. */
  init()?: Promise<unknown> | unknown;
  handleRequest(context: T, next: () => Promise<unknown>): Promise<unknown> | unknown;
}

/** Complete middleware type. */
export type MiddlewareOrMiddlewareObject = Middleware | MiddlewareObject;

/** Compose multiple middleware functions into a single middleware function. */
export function compose<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
>(
  middleware: MiddlewareOrMiddlewareObject<S, T>[],
): (context: T, next?: () => Promise<unknown>) => Promise<unknown> {
  return function composedMiddleware(
    context: T,
    next?: () => Promise<unknown>,
  ): Promise<unknown> {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error("next() called multiple times.");
      }
      index = i;
      let m: MiddlewareOrMiddlewareObject<S, T> | undefined = middleware[i];
      let fn: Middleware<S, T> | undefined;
      if (typeof m === "function") {
        fn = m;
      } else if (m && typeof m.handleRequest === "function") {
        fn = (m as MiddlewareObject).handleRequest;
      }
      if (i === middleware.length) {
        fn = next;
      }
      if (!fn) {
        return;
      }
      await fn(context, dispatch.bind(null, i + 1));
    }

    return dispatch(0);
  };
}
