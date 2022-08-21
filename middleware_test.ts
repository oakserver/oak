// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import { assert, assertEquals, assertStrictEquals } from "./test_deps.ts";
import { errors } from "./deps.ts";
import { createMockContext } from "./testing.ts";
import { compose, Middleware } from "./middleware.ts";

const { test } = Deno;

test({
  name: "test compose()",
  async fn() {
    const callStack: number[] = [];
    const mockContext = createMockContext();
    const mw1: Middleware = async (context, next) => {
      assertStrictEquals(context, mockContext);
      assertEquals(typeof next, "function");
      callStack.push(1);
      await next();
    };
    const mw2: Middleware = async (context, next) => {
      assertStrictEquals(context, mockContext);
      assertEquals(typeof next, "function");
      callStack.push(2);
      await next();
    };
    await compose([mw1, mw2])(mockContext);
    assertEquals(callStack, [1, 2]);
  },
});

test({
  name: "next() is catchable",
  async fn() {
    let caught: any;
    const mw1: Middleware = async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        caught = err;
      }
    };
    const mw2: Middleware = async (ctx) => {
      ctx.throw(500);
    };
    const context = createMockContext();
    await compose([mw1, mw2])(context);
    assert(caught instanceof errors.InternalServerError);
  },
});

test({
  name: "composed middleware accepts next middleware",
  async fn() {
    const callStack: number[] = [];
    const mockContext = createMockContext();

    const mw0: Middleware = async (context, next): Promise<void> => {
      assertEquals(typeof next, "function");
      callStack.push(3);
      await next();
    };

    const mw1: Middleware = async (context, next) => {
      assertEquals(typeof next, "function");
      callStack.push(1);
      await next();
    };
    const mw2: Middleware = async (context, next) => {
      assertEquals(typeof next, "function");
      callStack.push(2);
      await next();
    };

    await compose([mw1, mw2])(mockContext, mw0 as () => Promise<void>);
    assertEquals(callStack, [1, 2, 3]);
  },
});
