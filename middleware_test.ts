// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { test, assertEquals, assertStrictEq } from "./test_deps.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { compose, Middleware } from "./middleware.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

function createMockContext<S extends object = { [key: string]: any }>() {
  return ({
    request: {
      headers: new Headers(),
      method: "GET",
      path: "/",
      search: undefined,
      searchParams: new URLSearchParams(),
      url: "/",
    },
    response: {
      status: Status.OK,
      body: undefined,
      headers: new Headers(),
    },
  } as unknown) as Context<S>;
}

test(async function testCompose() {
  const callStack: number[] = [];
  const mockContext = createMockContext();
  const mw1: Middleware = async (context, next) => {
    assertStrictEq(context, mockContext);
    assertEquals(typeof next, "function");
    callStack.push(1);
    await next();
  };
  const mw2: Middleware = async (context, next) => {
    assertStrictEq(context, mockContext);
    assertEquals(typeof next, "function");
    callStack.push(2);
    await next();
  };
  await compose([mw1, mw2])(mockContext);
  assertEquals(callStack, [1, 2]);
});
