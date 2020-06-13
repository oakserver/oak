// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import {
  test,
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrowsAsync,
} from "./test_deps.ts";
import { Application, ListenOptions, ListenOptionsTls } from "./application.ts";
import { Context } from "./context.ts";
import {
  serve as denoServe,
  serveTLS as denoServeTls,
  Server,
  ServerRequest,
} from "./deps.ts";
import { Data, KeyStack } from "./keyStack.ts";
import { httpErrors } from "./httpError.ts";
let serverRequestStack: ServerRequest[] = [];
let requestResponseStack: ServerResponse[] = [];
let addrStack: Array<string | ListenOptions> = [];
let httpsOptionsStack: Array<Omit<ListenOptionsTls, "secure">> = [];

function teardown() {
  serverRequestStack = [];
  requestResponseStack = [];
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

const serve: typeof denoServe = function (
  addr: string | ListenOptions,
): Server {
  addrStack.push(addr);
  return new MockServer() as Server;
};

const serveTls: typeof denoServeTls = function (
  options: Omit<ListenOptionsTls, "secure">,
): Server {
  httpsOptionsStack.push(options);
  return new MockServer() as Server;
};

interface ServerResponse {
  status?: number;
  headers?: Headers;
  body?: Uint8Array;
}

function createMockRequest(
  url = "/index.html",
  proto = "HTTP/1.1",
  headersInit: string[][] = [["host", "example.com"]],
): ServerRequest {
  return {
    url,
    headers: new Headers(headersInit),
    async respond(response: ServerResponse) {
      requestResponseStack.push(response);
    },
    proto,
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
    const app = new Application({ serve });
    let called = 0;
    app.use((context, next) => {
      assert(context instanceof Context);
      assertEquals(typeof next, "function");
      called++;
    });

    await app.listen(":8000");
    assertEquals(called, 1);
    teardown();
  },
});

test({
  name: "middleware execution order 1",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application({ serve });
    const callStack: number[] = [];
    app.use(() => {
      callStack.push(1);
    });

    app.use(() => {
      callStack.push(2);
    });

    await app.listen(":8000");
    assertEquals(callStack, [1]);
    teardown();
  },
});

test({
  name: "middleware execution order 2",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application({ serve });
    const callStack: number[] = [];
    app.use((_context, next) => {
      callStack.push(1);
      next();
    });

    app.use(() => {
      callStack.push(2);
    });

    await app.listen(":8000");
    assertEquals(callStack, [1, 2]);
    teardown();
  },
});

test({
  name: "middleware execution order 3",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application({ serve });
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

    await app.listen(":8000");
    assertEquals(callStack, [1, 3, 2, 4]);
    teardown();
  },
});

test({
  name: "middleware execution order 4",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application({ serve });
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

    await app.listen(":8000");
    assertEquals(callStack, [1, 3, 4, 2]);
    teardown();
  },
});

test({
  name: "app.listen",
  async fn() {
    const app = new Application({ serve });
    app.use(() => {});
    await app.listen("127.0.0.1:8080");
    assertEquals(addrStack, [{ hostname: "127.0.0.1", port: 8080 }]);
    teardown();
  },
});

test({
  name: "app.listen IPv6 Loopback",
  async fn() {
    const app = new Application({ serve });
    app.use(() => {});
    await app.listen("[::1]:8080");
    assertEquals(addrStack, [{ hostname: "::1", port: 8080 }]);
    teardown();
  },
});

test({
  name: "app.listen(options)",
  async fn() {
    const app = new Application({ serve });
    app.use(() => {});
    await app.listen({ port: 8000 });
    assertEquals(addrStack, [{ port: 8000 }]);
    teardown();
  },
});

test({
  name: "app.listenTLS",
  async fn() {
    const app = new Application({ serve, serveTls });
    app.use(() => {});
    await app.listen({
      port: 8000,
      secure: true,
      certFile: "",
      keyFile: "",
    });
    assertEquals(httpsOptionsStack, [
      {
        port: 8000,
        secure: true,
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
    const app = new Application<{ foo?: string }>({ state: {}, serve });
    app.state.foo = "bar";
    let called = false;
    app.use((context) => {
      assertEquals(context.state, { foo: "bar" });
      assertStrictEquals(app.state, context.state);
      called = true;
    });
    await app.listen(":8000");
    assert(called);
    teardown();
  },
});

test({
  name: "app.keys undefined",
  fn() {
    const app = new Application();
    assertEquals(app.keys, undefined);
  },
});

test({
  name: "app.keys passed as array",
  fn() {
    const app = new Application({ keys: ["foo"] });
    assert(app.keys instanceof KeyStack);
  },
});

test({
  name: "app.keys passed as KeyStack-like",
  fn() {
    const keys = {
      sign(data: Data): string {
        return "";
      },
      verify(data: Data, digest: string): boolean {
        return true;
      },
      indexOf(data: Data, digest: string): number {
        return 0;
      },
    } as KeyStack;
    const app = new Application({ keys });
    assert(app.keys === keys);
  },
});

test({
  name: "app.keys set as array",
  fn() {
    const app = new Application();
    app.keys = ["foo"];
    assert(app.keys instanceof KeyStack);
  },
});

test({
  name: "app.listen({ signal })",
  async fn() {
    const app = new Application({ serve });
    const abortController = new AbortController();
    serverRequestStack.push(createMockRequest());
    serverRequestStack.push(createMockRequest());
    let count = 0;
    app.use(() => {
      count++;
    });
    const p = app.listen("localhost:8000");
    abortController.abort();
    await p;
    assertEquals(count, 2);
    teardown();
  },
});

test({
  name: "app.addEventListener()",
  async fn() {
    const app = new Application({ serve });
    app.addEventListener("error", (evt) => {
      assert(evt.error instanceof httpErrors.InternalServerError);
    });
    serverRequestStack.push(createMockRequest());
    app.use((ctx) => {
      ctx.throw(500, "oops!");
    });
    await app.listen({ port: 8000 });
    teardown();
  },
});

test({
  name: "uncaught errors impact response",
  async fn() {
    const app = new Application({ serve });
    serverRequestStack.push(createMockRequest());
    app.use((ctx) => {
      ctx.throw(404, "File Not Found");
    });
    await app.listen({ port: 8000 });
    const [response] = requestResponseStack;
    assertEquals(response.status, 404);
    teardown();
  },
});

test({
  name: "app.listen() without middleware",
  async fn() {
    const app = new Application({ serve });
    await assertThrowsAsync(async () => {
      await app.listen(":8000");
    }, TypeError);
  },
});

test({
  name: "app.state type handling",
  fn() {
    const app = new Application({ state: { id: 1 } });
    app.use((ctx: Context<{ session: number }>) => {
      ctx.state.session = 0;
    }).use((ctx) => {
      ctx.state.id = 1;
      ctx.state.session = 2;
      // @ts-expect-error
      ctx.state.bar = 3;
    });
  },
});

test({
  name: "application listen event",
  async fn() {
    const app = new Application({ serve });
    let called = 0;
    app.addEventListener("listen", (evt) => {
      called++;
      assertEquals(evt.hostname, "localhost");
      assertEquals(evt.port, 80);
      assertEquals(evt.secure, false);
    });
    app.use((ctx) => {
      ctx.response.body = "hello world";
    });
    await app.listen({ hostname: "localhost", port: 80 });
    assertEquals(called, 1);
    teardown();
  },
});

test({
  name: "application doesn't respond on ctx.respond === false",
  async fn() {
    const app = new Application({ serve });
    serverRequestStack.push(createMockRequest());
    app.use((ctx) => {
      ctx.respond = false;
    });
    await app.listen({ port: 8000 });
    assertEquals(requestResponseStack.length, 0);
    teardown();
  },
});

test({
  name: "application passes proxy",
  async fn() {
    const app = new Application({ serve, proxy: true });
    serverRequestStack.push(
      createMockRequest(
        "/index.html",
        "HTTP/1.1",
        [
          ["host", "10.255.255.255"],
          ["x-forwarded-proto", "https"],
          ["x-forwarded-for", "10.10.10.10, 192.168.1.1, 10.255.255.255"],
          ["x-forwarded-host", "10.10.10.10"],
        ],
      ),
    );
    let called = false;
    app.use((ctx) => {
      called = true;
      assertEquals(String(ctx.request.url), "https://10.10.10.10/index.html");
    });
    await app.listen({ port: 8000 });
    assertEquals(requestResponseStack.length, 1);
    teardown();
  },
});
