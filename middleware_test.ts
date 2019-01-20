// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { test, assert } from "https://deno.land/x/std/testing/mod.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { compose, Middleware } from "./middleware.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

function createMockContext<S extends object = { [key: string]: any }>() {
  return {
    request: {
      headers: new Headers(),
      method: "GET",
      path: "/",
      search: undefined,
      searchParams: new URLSearchParams(),
      url: "/"
    } as Request,
    response: {
      status: Status.OK,
      body: undefined,
      headers: new Headers()
    } as Response
  } as Context<S>;
}

test(async function testCompose() {
  const callStack: number[] = [];
  const mockContext = createMockContext();
  const mw1: Middleware = async (context, next) => {
    assert.strictEqual(context, mockContext);
    assert.equal(typeof next, "function");
    callStack.push(1);
    await next();
  };
  const mw2: Middleware = async (context, next) => {
    assert.strictEqual(context, mockContext);
    assert.equal(typeof next, "function");
    callStack.push(2);
    await next();
  };
  await compose([mw1, mw2])(mockContext);
  assert.equal(callStack, [1, 2]);
});
