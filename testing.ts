// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

/**
 * A collection of utility APIs which can make testing of an oak application
 * easier.
 *
 * @module
 */

import type { Application, State } from "./application.ts";
import { accepts, createHttpError } from "./deps.ts";
import type { RouteParams, RouterContext } from "./router.ts";
import type { ErrorStatus } from "./types.d.ts";
import { Cookies } from "./cookies.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

/** Creates a mock of `Application`. */
export function createMockApp<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  state = {} as S,
): Application<S> {
  const app = {
    state,
    use() {
      return app;
    },
    [Symbol.for("Deno.customInspect")]() {
      return "MockApplication {}";
    },
    [Symbol.for("nodejs.util.inspect.custom")](
      depth: number,
      options: any,
      inspect: (value: unknown, options?: unknown) => string,
    ) {
      if (depth < 0) {
        return options.stylize(`[MockApplication]`, "special");
      }

      const newOptions = Object.assign({}, options, {
        depth: options.depth === null ? null : options.depth - 1,
      });
      return `${options.stylize("MockApplication", "special")} ${
        inspect({}, newOptions)
      }`;
    },
  } as any;
  return app;
}

/** Options that can be set in a mock context. */
export interface MockContextOptions<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  S extends State = Record<string, any>,
> {
  app?: Application<S>;
  ip?: string;
  method?: string;
  params?: P;
  path?: string;
  state?: S;
  headers?: [string, string][];
}

/** Allows external parties to modify the context state. */
export const mockContextState = {
  /** Adjusts the return value of the `acceptedEncodings` in the context's
   * `request` object. */
  encodingsAccepted: "identity",
};

/** Create a mock of `Context` or `RouterContext`. */
export function createMockContext<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  S extends State = Record<string, any>,
>(
  {
    ip = "127.0.0.1",
    method = "GET",
    params,
    path = "/",
    state,
    app = createMockApp(state),
    headers: requestHeaders,
  }: MockContextOptions<R> = {},
) {
  function createMockRequest(): Request {
    const headers = new Headers(requestHeaders);
    return {
      accepts(...types: string[]) {
        if (!headers.has("Accept")) {
          return;
        }
        if (types.length) {
          return accepts({ headers }, ...types);
        }
        return accepts({ headers });
      },
      acceptsEncodings() {
        return mockContextState.encodingsAccepted;
      },
      headers,
      ip,
      method,
      path,
      search: undefined,
      searchParams: new URLSearchParams(),
      url: new URL(path, "http://localhost/"),
    } as any;
  }

  const request = createMockRequest();
  const response = new Response(request);
  const cookies = new Cookies(request, response);

  return ({
    app,
    params,
    request,
    cookies,
    response,
    state: Object.assign({}, app.state),
    assert(
      condition: any,
      errorStatus: ErrorStatus = 500,
      message?: string,
      props?: Record<string, unknown>,
    ): asserts condition {
      if (condition) {
        return;
      }
      const err = createHttpError(errorStatus, message);
      if (props) {
        Object.assign(err, props);
      }
      throw err;
    },
    throw(
      errorStatus: ErrorStatus,
      message?: string,
      props?: Record<string, unknown>,
    ): never {
      const err = createHttpError(errorStatus, message);
      if (props) {
        Object.assign(err, props);
      }
      throw err;
    },
    [Symbol.for("Deno.customInspect")]() {
      return `MockContext {}`;
    },
    [Symbol.for("nodejs.util.inspect.custom")](
      depth: number,
      options: any,
      inspect: (value: unknown, options?: unknown) => string,
    ) {
      if (depth < 0) {
        return options.stylize(`[MockContext]`, "special");
      }

      const newOptions = Object.assign({}, options, {
        depth: options.depth === null ? null : options.depth - 1,
      });
      return `${options.stylize("MockContext", "special")} ${
        inspect({}, newOptions)
      }`;
    },
  } as unknown) as RouterContext<R, P, S>;
}

/** Creates a mock `next()` function which can be used when calling
 * middleware. */
export function createMockNext() {
  return async function next() {};
}
