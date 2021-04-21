// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import { assert, assertEquals, assertThrowsAsync, test } from "./test_deps.ts";

import {
  Application,
  ListenOptions,
  ListenOptionsTls,
  State,
} from "./application.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { NativeRequest } from "./http_server_native.ts";
import type { ServerRequest, ServerResponse } from "./http_server_std.ts";
import { httpErrors } from "./httpError.ts";
import { Data, KeyStack } from "./keyStack.ts";
import type { FetchEvent, Server } from "./types.d.ts";

let serverRequestStack: ServerRequest[] = [];
let requestResponseStack: ServerResponse[] = [];
let nativeRequestStack: NativeRequest[] = [];
let optionsStack: Array<ListenOptions | ListenOptionsTls> = [];
let serverClosed = false;

function teardown() {
  serverRequestStack = [];
  requestResponseStack = [];
  nativeRequestStack = [];
  optionsStack = [];
  serverClosed = false;
}

class MockServer<AS extends State = Record<string, any>>
  implements Server<ServerRequest> {
  constructor(
    _app: Application<AS>,
    options: Deno.ListenOptions | Deno.ListenTlsOptions,
  ) {
    optionsStack.push(options);
  }

  close(): void {
    serverClosed = true;
  }

  async *[Symbol.asyncIterator]() {
    for await (const request of serverRequestStack) {
      yield request;
    }
  }
}

class MockNativeServer<AS extends State = Record<string, any>>
  implements Server<NativeRequest> {
  constructor(
    _app: Application<AS>,
    options: Deno.ListenOptions | Deno.ListenTlsOptions,
  ) {
    optionsStack.push(options);
  }

  close(): void {
    serverClosed = true;
  }

  async *[Symbol.asyncIterator]() {
    for await (const request of nativeRequestStack) {
      yield request;
    }
  }
}

function createMockRequest(
  url = "/index.html",
  proto = "HTTP/1.1",
  headersInit: string[][] = [["host", "example.com"]],
): ServerRequest {
  return {
    url,
    headers: new Headers(headersInit),
    respond(response: ServerResponse) {
      requestResponseStack.push(response);
      return Promise.resolve();
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
    app.use(() => {});
    await app.listen("127.0.0.1:8080");
    assertEquals(optionsStack, [{ hostname: "127.0.0.1", port: 8080 }]);
    teardown();
  },
});

test({
  name: "app.listen native",
  async fn() {
    const app = new Application({ serverConstructor: MockNativeServer });
    app.use(() => {});
    await app.listen("127.0.0.1:8080");
    assertEquals(optionsStack, [{ hostname: "127.0.0.1", port: 8080 }]);
    teardown();
  },
});

test({
  name: "app.listen IPv6 Loopback",
  async fn() {
    const app = new Application({ serverConstructor: MockServer });
    app.use(() => {});
    await app.listen("[::1]:8080");
    assertEquals(optionsStack, [{ hostname: "::1", port: 8080 }]);
    teardown();
  },
});

test({
  name: "app.listen(options)",
  async fn() {
    const app = new Application({ serverConstructor: MockServer });
    app.use(() => {});
    await app.listen({ port: 8000 });
    assertEquals(optionsStack, [{ port: 8000 }]);
    teardown();
  },
});

test({
  name: "app.listenTLS",
  async fn() {
    const app = new Application({ serverConstructor: MockServer });
    app.use(() => {});
    await app.listen({
      port: 8000,
      secure: true,
      certFile: "",
      keyFile: "",
    });
    assertEquals(optionsStack, [
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
    const app = new Application<{ foo?: string }>({
      state: {},
      serverConstructor: MockServer,
    });
    app.state.foo = "bar";
    let called = false;
    app.use((context) => {
      assertEquals(context.state, { foo: "bar" });
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
  name: "app.listen({ signal }) no requests in flight",
  async fn() {
    const app = new Application({ serverConstructor: MockServer });
    const abortController = new AbortController();
    app.use(() => {});
    const p = app.listen({ port: 8000, signal: abortController.signal });
    abortController.abort();
    await p;
    assertEquals(serverClosed, true);
    teardown();
  },
});

test({
  name: "app.listen({ signal }) requests in flight",
  async fn() {
    const app = new Application({ serverConstructor: MockServer });
    const abortController = new AbortController();
    serverRequestStack.push(createMockRequest());
    serverRequestStack.push(createMockRequest());
    serverRequestStack.push(createMockRequest());
    serverRequestStack.push(createMockRequest());
    let count = 0;
    app.use(() => {
      assertEquals(serverClosed, false);
      count++;
      if (count === 2) {
        abortController.abort();
      }
    });
    await app.listen({ port: 8000, signal: abortController.signal });
    assertEquals(count, 2);
    assertEquals(serverClosed, true);
    teardown();
  },
});

test({
  name: "app.addEventListener()",
  async fn() {
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer });
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
    const app = new Application({ serverConstructor: MockServer, proxy: true });
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
    assert(called);
    assertEquals(requestResponseStack.length, 1);
    teardown();
  },
});

test({
  name: "application .handle()",
  async fn() {
    const app = new Application();
    let called = 0;
    app.use((context, next) => {
      assert(context instanceof Context);
      assertEquals(typeof next, "function");
      called++;
    });
    const actual = await app.handle(createMockRequest());
    assertEquals(called, 1);
    assert(actual);
    assertEquals(actual.body, undefined);
    assertEquals(actual.status, Status.NotFound);
    assertEquals([...actual.headers], [["content-length", "0"]]);
  },
});

test({
  name: "application .handle() native request",
  async fn() {
    const app = new Application();
    let called = 0;
    app.use((context, next) => {
      assert(context instanceof Context);
      assertEquals(context.request.ip, "example.com");
      assertEquals(typeof next, "function");
      called++;
    });
    const request = new Request("http://localhost:8080/", {
      method: "POST",
      body: `{"a":"b"}`,
    });
    const conn = {
      localAddr: { transport: "tcp", hostname: "localhost", port: 8000 },
      remoteAddr: { transport: "tcp", hostname: "example.com", port: 4747 },
      rid: 1,
    } as Deno.Conn;
    const actual = await app.handle(request, conn);
    assertEquals(called, 1);
    assert(actual instanceof Response);
    assertEquals(actual.body, null);
    assertEquals(actual.status, Status.NotFound);
    assertEquals([...actual.headers], [["content-length", "0"]]);
  },
});

test({
  name: "application .handle() omit connection",
  async fn() {
    const app = new Application();
    let called = 0;
    app.use((context, next) => {
      assert(context instanceof Context);
      assertEquals(context.request.ip, "");
      assertEquals(typeof next, "function");
      called++;
    });
    const request = new Request("http://localhost:8080/", {
      method: "POST",
      body: `{"a":"b"}`,
    });
    const actual = await app.handle(request);
    assertEquals(called, 1);
    assert(actual instanceof Response);
    assertEquals(actual.body, null);
    assertEquals(actual.status, Status.NotFound);
    assertEquals([...actual.headers], [["content-length", "0"]]);
  },
});

test({
  name: "application .handle() no response",
  async fn() {
    const app = new Application();
    app.use((context) => {
      context.respond = false;
    });
    const actual = await app.handle(createMockRequest());
    assertEquals(actual, undefined);
  },
});

test({
  name: "application .handle() no middleware throws",
  async fn() {
    const app = new Application();
    await assertThrowsAsync(async () => {
      await app.handle(createMockRequest());
    }, TypeError);
  },
});

test({
  name: "application .fetchEventHandler()",
  async fn() {
    let respondCount = 0;
    let response: Response | undefined;

    async function respondWith(
      p: Response | Promise<Response>,
    ): Promise<Response> {
      respondCount++;
      response = await p;
      return response;
    }

    const app = new Application();
    app.use((ctx) => {
      ctx.response.body = "hello oak";
    });
    const handler = app.fetchEventHandler();
    const request = new Request("http://localhost:8000/");
    await handler.handleEvent({ request, respondWith } as FetchEvent);
    assertEquals(respondCount, 1);
    assert(response);
    assert(await response.text(), "hello oak");
  },
});
