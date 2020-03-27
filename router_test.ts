// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertStrictEq, test } from "./test_deps.ts";
import { Application } from "./application.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { Router, RouterContext, RouteParams } from "./router.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

function createMockApp<S extends object = { [key: string]: any }>(
  state = {} as S,
): Application<S> {
  return {
    state,
  } as any;
}

function createMockContext<S extends object = { [key: string]: any }>(
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
      url: path,
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

function setup<S extends object = { [key: string]: any }>(
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

test(async function emptyRoutes() {
  const { context, next } = setup();

  const router = new Router();
  const mw = router.routes();
  assertEquals(await mw(context, next), undefined);
});

test(async function getSingleMatch() {
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
});

test(async function matchSingleParam() {
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
});

test(async function matchWithNext() {
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
});

test(async function matchDelete() {
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
});

test(async function matchGet() {
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
});

test(async function matchHead() {
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
});

test(async function matchOptions() {
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
});

test(async function matchPatch() {
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
});

test(async function matchPost() {
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
});

test(async function matchPut() {
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
});

test(async function matchPrefix() {
  const { context, next } = setup("/route1/action1", "GET");
  const callStack: number[] = [];
  const router = new Router({ prefix: "/route1" });
  router.get("/action1", () => {
    callStack.push(0);
  });
  const mw = router.routes();
  await mw(context, next);
  assertEquals(callStack, [0]);
});
