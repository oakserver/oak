// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { test, assert } from "https://deno.land/x/std/testing/mod.ts";
import { Application } from "./application.ts";
import { Context } from "./context.ts";
import { serve, ServerRequest } from "./deps.ts";

let serverRequestStack: ServerRequest[] = [];
let addrStack: string[] = [];

function teardown() {
  serverRequestStack = [];
  addrStack = [];
}

const mockServe: typeof serve = async function*(addr: string) {
  addrStack.push(addr);
  for (const request of serverRequestStack) {
    yield request;
  }
};

function createMockRequest(url = "https://example.com/"): ServerRequest {
  return {
    url,
    async respond() {}
  } as any;
}

test(function constructApp() {
  const app = new Application();
  assert(app instanceof Application);
});

test(async function registerMiddleware() {
  serverRequestStack.push(createMockRequest());
  const app = new Application(mockServe);
  let called = 0;
  app.use((context, next) => {
    assert(context instanceof Context);
    assert.equal(typeof next, "function");
    called++;
  });

  await app.listen("");
  assert.equal(called, 1);
  teardown();
});

test(async function middlewareExecutionOrder1() {
  serverRequestStack.push(createMockRequest());
  const app = new Application(mockServe);
  const callStack: number[] = [];
  app.use(() => {
    callStack.push(1);
  });

  app.use(() => {
    callStack.push(2);
  });

  await app.listen("");
  assert.equal(callStack, [1]);
  teardown();
});

test(async function middlewareExecutionOrder2() {
  serverRequestStack.push(createMockRequest());
  const app = new Application(mockServe);
  const callStack: number[] = [];
  app.use((_context, next) => {
    callStack.push(1);
    next();
  });

  app.use(() => {
    callStack.push(2);
  });

  await app.listen("");
  assert.equal(callStack, [1, 2]);
  teardown();
});

test(async function middlewareExecutionOrder3() {
  serverRequestStack.push(createMockRequest());
  const app = new Application(mockServe);
  const callStack: number[] = [];
  app.use((_context, next) => {
    callStack.push(1);
    next();
    callStack.push(2);
  });

  app.use(async () => {
    callStack.push(3);
    await Promise.resolve();
    callStack.push(4);
  });

  await app.listen("");
  assert.equal(callStack, [1, 3, 2, 4]);
  teardown();
});

test(async function middlewareExecutionOrder4() {
  serverRequestStack.push(createMockRequest());
  const app = new Application(mockServe);
  const callStack: number[] = [];
  app.use(async (_context, next) => {
    callStack.push(1);
    await next();
    callStack.push(2);
  });

  app.use(async () => {
    callStack.push(3);
    await Promise.resolve();
    callStack.push(4);
  });

  await app.listen("");
  assert.equal(callStack, [1, 3, 4, 2]);
  teardown();
});

test(async function appListen() {
  const app = new Application(mockServe);
  await app.listen("127.0.0.1:8080");
  assert.equal(addrStack, ["127.0.0.1:8080"]);
  teardown();
});

test(async function appState() {
  serverRequestStack.push(createMockRequest());
  const app = new Application<{ foo?: string }>(mockServe);
  app.state.foo = "bar";
  let called = false;
  app.use(context => {
    assert.equal(context.state, { foo: "bar" });
    assert.strictEqual(app.state, context.state);
    called = true;
  });
  await app.listen("");
  assert(called);
});
