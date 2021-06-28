// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

// A module of utility functions which can make testing an oak application
// easier.

import type { Application, State } from "./application.ts";
import { Status } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import type { RouteParams, RouterContext } from "./router.ts";
import type { ErrorStatus } from "./types.d.ts";

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
      return `MockApplication {}`;
    },
  } as any;
  return app;
}

/** Options that can be set in a mock context. */
export interface MockContextOptions<
  P extends RouteParams = RouteParams,
  S extends State = Record<string, any>,
> {
  app?: Application<S>;
  ip?: string;
  method?: string;
  params?: P;
  path?: string;
  state?: S;
}

/** Allows external parties to modify the context state. */
export const mockContextState = {
  /** Adjusts the return value of the `acceptedEncodings` in the context's
   * `request` object. */
  encodingsAccepted: "identity",
};

/** Create a mock of `Context` or `RouterContext`. */
export function createMockContext<
  P extends RouteParams = RouteParams,
  S extends State = Record<string, any>,
>(
  {
    app,
    ip = "127.0.0.1",
    method = "GET",
    params,
    path = "/",
    state,
  }: MockContextOptions = {},
) {
  if (!app) {
    app = createMockApp(state);
  }
  let body: any;
  let status = Status.OK;
  const headers = new Headers();
  const resources: number[] = [];
  return ({
    app,
    params,
    request: {
      acceptsEncodings() {
        return mockContextState.encodingsAccepted;
      },
      headers: new Headers(),
      ip,
      method,
      path,
      search: undefined,
      searchParams: new URLSearchParams(),
      url: new URL(path, "http://localhost/"),
    },
    response: {
      get status(): Status {
        return status;
      },
      set status(value: Status) {
        status = value;
      },
      get body(): any {
        return body;
      },
      set body(value: any) {
        body = value;
      },
      addResource(rid: number) {
        resources.push(rid);
      },
      destroy() {
        body = undefined;
        for (const rid of resources) {
          Deno.close(rid);
        }
      },
      redirect(url: string | URL) {
        headers.set("Location", encodeURI(String(url)));
      },
      headers,
      toDomResponse() {
        return Promise.resolve(new Response(body, { status, headers }));
      },
      toServerResponse() {
        return Promise.resolve({
          status,
          body,
          headers,
        });
      },
    },
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
  } as unknown) as RouterContext<P, S>;
}

/** Creates a mock `next()` function which can be used when calling
 * middleware. */
export function createMockNext() {
  return async function next() {};
}
