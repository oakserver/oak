// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assert, assertEquals, assertStrictEq } from "./test_deps.ts";
import { Application } from "./application.ts";
import { Context } from "./context.ts";
import {
  HTTPOptions,
  HTTPSOptions,
  serve,
  serveTLS,
  Server,
  ServerRequest,
} from "./deps.ts";

let serverRequestStack: ServerRequest[] = [];
let addrStack: Array<string | HTTPOptions> = [];
let httpsOptionsStack: HTTPSOptions[] = [];

function teardown() {
  serverRequestStack = [];
  addrStack = [];
  httpsOptionsStack = [];
}

class MockServer {
  close(): void {}

  async *[Symbol.asyncIterator]() {
    for await (const request of serverRequestStack) {
      yield request;
    }
  }
}

const mockServe: typeof serve = function (addr: string | HTTPOptions): Server {
  addrStack.push(addr);
  return new MockServer() as Server;
};

const mockServeTLS: typeof serveTLS = function (options: HTTPSOptions): Server {
  httpsOptionsStack.push(options);
  return new MockServer() as Server;
};

function createMockRequest(url = "https://example.com/"): ServerRequest {
  return {
    url,
    headers: new Headers(),
    async respond() {},
  } as any;
}

test({
  name: "construct App()",
  fn() {
    const app = new Application();
    assert(app instanceof Application);
  },
});

test({
  name: "register middleware",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application(mockServe);
    let called = 0;
    app.use((context, next) => {
      assert(context instanceof Context);
      assertEquals(typeof next, "function");
      called++;
    });

    await app.listen("");
    assertEquals(called, 1);
    teardown();
  },
});

test({
  name: "middleware execution order 1",
  async fn() {
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
    assertEquals(callStack, [1]);
    teardown();
  },
});

test({
  name: "middleware execution order 2",
  async fn() {
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
    assertEquals(callStack, [1, 2]);
    teardown();
  },
});

test({
  name: "middleware execution order 3",
  async fn() {
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
    assertEquals(callStack, [1, 3, 2, 4]);
    teardown();
  },
});

test({
  name: "middleware execution order 4",
  async fn() {
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
    assertEquals(callStack, [1, 3, 4, 2]);
    teardown();
  },
});

test({
  name: "app.listen",
  async fn() {
    const app = new Application(mockServe);
    await app.listen("127.0.0.1:8080");
    assertEquals(addrStack, ["127.0.0.1:8080"]);
    teardown();
  },
});

test({
  name: "app.listen(options)",
  async fn() {
    const app = new Application(mockServe);
    await app.listen({ port: 8000 });
    assertEquals(addrStack, [{ port: 8000 }]);
    teardown();
  },
});

test({
  name: "app.listenTLS",
  async fn() {
    const app = new Application(mockServe, mockServeTLS);
    await app.listenTLS({
      port: 8000,
      certFile: "",
      keyFile: "",
    });
    assertEquals(httpsOptionsStack, [
      {
        port: 8000,
        certFile: "",
        keyFile: "",
      },
    ]);
    teardown();
  },
});

test({
  name: "app.state",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application<{ foo?: string }>(mockServe);
    app.state.foo = "bar";
    let called = false;
    app.use((context) => {
      assertEquals(context.state, { foo: "bar" });
      assertStrictEq(app.state, context.state);
      called = true;
    });
    await app.listen("");
    assert(called);
  },
});
