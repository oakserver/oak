// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, assertThrows } from "https://deno.land/x/std/testing/asserts.ts";
import { test } from "https://deno.land/x/std/testing/mod.ts";
import { Application } from "./application.ts";
import { Context } from "./context.ts";
import { ServerRequest } from "./deps.ts";
import httpError from "./httpError.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

function createMockApp<S extends object = { [key: string]: any }>(
  state = {} as S
): Application<S> {
  return {
    state
  } as any;
}

function createMockServerRequest(url = "/"): ServerRequest {
  const headers = new Headers();
  return {
    headers,
    method: "GET",
    url,
    async respond() {}
  } as any;
}

test(function context() {
  const app = createMockApp();
  const serverRequest = createMockServerRequest();
  const context = new Context(app, serverRequest);
  assert(context instanceof Context);
  assertEquals(context.state, app.state);
  assertEquals(context.app, app);
  assert(context.request instanceof Request);
  assert(context.response instanceof Response);
});

test(function contextThrows() {
  const context = new Context(createMockApp(), createMockServerRequest());
  assertThrows(
    () => {
      context.throw(404, "foobar");
    },
    httpError.NotFound,
    "foobar"
  );
});
