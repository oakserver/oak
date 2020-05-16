// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertStrictEq, test } from "./test_deps.ts";
import { Application } from "./application.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { Router } from "./router.ts";
import {
  assertThrows,
  assertThrowsAsync,
} from "https://deno.land/std@0.51.0/testing/asserts.ts";
function createMockApp<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  state = {} as S,
): Application<S> {
  return {
    state,
  } as any;
}

function createMockContext<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  app: Application<S>,
  path = "/",
  method = "GET",
) {
  return ({
    app,
    request: {
      headers: new Headers(),
      method,
      path,
      search: undefined,
      searchParams: new URLSearchParams(),
      url: new URL(`http://localhost${path}`),
    },
    response: {
      status: Status.OK,
      body: undefined,
      headers: new Headers(),
    },
    state: app.state,
  } as unknown) as Context<S>;
}

function createMockNext() {
  return async function next() {};
}

function setup<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  path = "/",
  method = "GET",
): {
  app: Application<S>;
  context: Context<S>;
  next: () => Promise<void>;
} {
  const app = createMockApp<S>();
  const context = createMockContext<S>(app, path, method);
  const next = createMockNext();
  return { app, context, next };
}

test({
  name: "router empty routes",
  async fn() {
    const { context, next } = setup();

    const router = new Router();
    const mw = router.routes();
    assertEquals(await mw(context, next), undefined);
  },
});

test({
  name: "router get single match",
  async fn() {
    const { app, context, next } = setup("/", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.get("/", (context) => {
      assertStrictEq(context.router, router);
      assertStrictEq(context.app, app);
      callStack.push(1);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [1]);
  },
});

test({
  name: "router match single param",
  async fn() {
    const { context, next } = setup("/foo/bar", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.get("/", (context) => {
      callStack.push(1);
    });
    router.get("/foo", (context) => {
      callStack.push(2);
    });
    router.get<{ id: string }>("/foo/:id", (context) => {
      callStack.push(3);
      assertEquals(context.params.id, "bar");
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [3]);
  },
});

test({
  name: "router match with next",
  async fn() {
    const { context, next } = setup("/foo", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.get("/", (_context) => {
      callStack.push(1);
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(2);
      await next();
    });
    router.get("/foo", () => {
      callStack.push(3);
    });
    router.get("/foo", () => {
      callStack.push(4);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [2, 3]);
  },
});

test({
  name: "router match delete",
  async fn() {
    const { context, next } = setup("/", "DELETE");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 1]);
  },
});

test({
  name: "router match get",
  async fn() {
    const { context, next } = setup("/", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 2]);
  },
});

test({
  name: "router match head",
  async fn() {
    const { context, next } = setup("/", "HEAD");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 3]);
  },
});

test({
  name: "router match options",
  async fn() {
    const { context, next } = setup("/", "OPTIONS");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [4]);
  },
});

test({
  name: "router match patch",
  async fn() {
    const { context, next } = setup("/", "PATCH");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [5]);
  },
});

test({
  name: "router match post",
  async fn() {
    const { context, next } = setup("/", "POST");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 6]);
  },
});

test({
  name: "router match put",
  async fn() {
    const { context, next } = setup("/", "PUT");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 7]);
  },
});

test({
  name: "router patch prefix",
  async fn() {
    const { context, next } = setup("/route1/action1", "GET");
    const callStack: number[] = [];
    const router = new Router({ prefix: "/route1" });
    router.get("/action1", () => {
      callStack.push(0);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0]);
  },
});

test({
  name: "router match strict",
  async fn() {
    const { context, next } = setup("/route", "GET");
    const callStack: number[] = [];
    const router = new Router({ strict: true });
    router.get("/route", () => {
      callStack.push(0);
    });
    router.get("/route/", () => {
      callStack.push(1);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0]);
  },
});

test({
  name: "router as iterator",
  fn() {
    const router = new Router();
    router.all("/route", () => {});
    router.delete("/route/:id", () => {});
    router.patch("/route/:id", () => {});
    const routes = [...router];
    assertEquals(routes.length, 3);
    assertEquals(routes[0].path, "/route");
    assertEquals(routes[0].methods, ["HEAD", "DELETE", "GET", "POST", "PUT"]);
    assertEquals(routes[0].middleware.length, 1);
  },
});

test({
  name: "route throws",
  fn() {
    const { context, next } = setup();
    const router = new Router();
    router.all("/", (ctx) => {
      ctx.throw(404);
    });
    const mw = router.routes();
    assertThrowsAsync(async () => {
      await mw(context, next);
    });
  },
});
