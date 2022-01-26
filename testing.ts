// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

// A module of utility functions which can make testing an oak application
// easier.

import type { Application, State } from "./application.ts";
import { createHttpError } from "./httpError.ts";
import type { RouteParams, RouterContext } from "./router.ts";
import type { ErrorStatus } from "./types.d.ts";
import { Cookies } from "./cookies.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { preferredMediaTypes } from "./negotiation/mediaType.ts";

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
    headers,
  }: MockContextOptions<R> = {},
) {
  function createMockRequest(): Request {
    const headerMap = new Headers(headers);
    return {
      accepts(...types: string[]) {
        const acceptValue = headerMap.get("Accept");
        if (!acceptValue) {
          return;
        }
        if (types.length) {
          return preferredMediaTypes(acceptValue, types)[0];
        }
        return preferredMediaTypes(acceptValue);
      },
      acceptsEncodings() {
        return mockContextState.encodingsAccepted;
      },
      headers: headerMap,
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
  } as unknown) as RouterContext<R, P, S>;
}

/** Creates a mock `next()` function which can be used when calling
 * middleware. */
export function createMockNext() {
  return async function next() {};
}
