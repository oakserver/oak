// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assert, assertEquals, assertStrictEquals } from "./test_deps.ts";
import { State } from "./application.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { createHttpError, httpErrors } from "./httpError.ts";
import { ErrorStatus } from "./types.d.ts";
import { compose, Middleware } from "./middleware.ts";
function createMockContext<S extends State = Record<string, any>>() {
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
    assert(
      condition: any,
      errorStatus: ErrorStatus = 500,
      message?: string,
      props?: object,
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
    throw(errorStatus: ErrorStatus, message?: string, props?: object): never {
      const err = createHttpError(errorStatus, message);
      if (props) {
        Object.assign(err, props);
      }
      throw err;
    },
  } as unknown) as Context<S>;
}

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
    assert(caught instanceof httpErrors.InternalServerError);
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
