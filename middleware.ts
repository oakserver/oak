// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import type { State } from "./application.ts";
import type { Context } from "./context.ts";

/** A function for chaining middleware. */
export type Next = () => Promise<unknown>;

/** Middleware are functions which are chained together to deal with
 * requests. */
export interface Middleware<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
> {
  (context: T, next: Next): Promise<unknown> | unknown;
}

/** Middleware objects allow encapsulation of middleware along with the ability
 * to initialize the middleware upon listen. */
export interface MiddlewareObject<
  S extends State = Record<string, any>,
  T extends Context<S> = Context<S>,
> {
  /** Optional function for delayed initialization which will be called when
   * the application starts listening. */
  init?: () => Promise<unknown> | unknown;
  /** The method to be called to handle the request. */
  handleRequest(context: T, next: Next): Promise<unknown> | unknown;
}

/** Type that represents {@linkcode Middleware} or
 * {@linkcode MiddlewareObject}. */
export type MiddlewareOrMiddlewareObject<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
> = Middleware<S, T> | MiddlewareObject<S, T>;

/** A type guard that returns true if the value is
 * {@linkcode MiddlewareObject}. */
export function isMiddlewareObject<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
>(value: MiddlewareOrMiddlewareObject<S, T>): value is MiddlewareObject<S, T> {
  return value && typeof value === "object" && "handleRequest" in value;
}

/** Compose multiple middleware functions into a single middleware function. */
export function compose<
  S extends State = Record<string, any>,
  T extends Context = Context<S>,
>(
  middleware: MiddlewareOrMiddlewareObject<S, T>[],
): (context: T, next?: Next) => Promise<unknown> {
  return function composedMiddleware(
    context: T,
    next?: Next,
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
        fn = (m as MiddlewareObject).handleRequest.bind(m);
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
