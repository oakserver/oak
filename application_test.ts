// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrowsAsync,
} from "./test_deps.ts";

import { Application } from "./application.ts";
import type {
  ApplicationErrorEvent,
  ListenOptions,
  ListenOptionsTls,
  State,
} from "./application.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { HttpServerNative, NativeRequest } from "./http_server_native.ts";
import { HttpServerStd } from "./http_server_std.ts";
import type { ServerRequest, ServerResponse } from "./http_server_std.ts";
import { httpErrors } from "./httpError.ts";
import { Data, KeyStack } from "./keyStack.ts";
import type { FetchEvent, Server } from "./types.d.ts";

const { test } = Deno;

let serverRequestStack: ServerRequest[] = [];
let requestResponseStack: ServerResponse[] = [];
let nativeRequestStack: NativeRequest[] = [];
let nativeRequestResponseStack: (Promise<Response> | Response)[] = [];
let optionsStack: Array<ListenOptions | ListenOptionsTls> = [];
let serverClosed = false;

function teardown() {
  serverRequestStack = [];
  requestResponseStack = [];
  nativeRequestStack = [];
  nativeRequestResponseStack = [];
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

function createMockNativeRequest(
  url = "http://localhost/index.html",
  requestInit?: RequestInit,
): NativeRequest {
  const request = new Request(url, requestInit);

  return new NativeRequest({
    request,
    respondWith(r) {
      nativeRequestResponseStack.push(r);
      return Promise.resolve();
    },
  });
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
  name: "register middleware - accepts non void",
  fn() {
    const app = new Application({ serverConstructor: MockServer });
    app.use((ctx) => ctx.response.body = "hello world");
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
  name: "app - contextState - clone",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application({
      contextState: "clone",
      state: {
        a() {},
        b: "string",
        c: /c/,
      },
      serverConstructor: MockServer,
    });
    let called = false;
    app.use((ctx) => {
      assertEquals(ctx.state, { b: "string" });
      assert(ctx.state !== ctx.app.state);
      called = true;
    });
    await app.listen({ port: 8000 });
    assert(called);
    teardown();
  },
});

test({
  name: "app - contextState - prototype",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const state = {
      a: "a",
      b: { c: "c" },
    };
    const app = new Application({
      contextState: "prototype",
      state,
      serverConstructor: MockServer,
    });
    let called = false;
    app.use<typeof state & { d: string }>((ctx) => {
      assert(ctx.state !== ctx.app.state);
      assert(Object.getPrototypeOf(ctx.state) === ctx.app.state);
      assertEquals(ctx.state.a, "a");
      assertEquals(ctx.state.b, { c: "c" });
      ctx.state.a = "f";
      ctx.state.d = "d";
      ctx.state.b.c = "e";
      assertEquals(ctx.app.state, { a: "a", b: { c: "e" } });
      called = true;
    });
    await app.listen({ port: 8000 });
    assert(called);
    teardown();
  },
});

test({
  name: "app - contextState - alias",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application({
      contextState: "alias",
      state: {
        a() {},
        b: "string",
        c: /c/,
      },
      serverConstructor: MockServer,
    });
    let called = false;
    app.use((ctx) => {
      assertStrictEquals(ctx.state, ctx.app.state);
      called = true;
    });
    await app.listen({ port: 8000 });
    assert(called);
    teardown();
  },
});

test({
  name: "app - contextState - empty",
  async fn() {
    serverRequestStack.push(createMockRequest());
    const app = new Application({
      contextState: "empty",
      state: {
        a() {},
        b: "string",
        c: /c/,
      },
      serverConstructor: MockServer,
    });
    let called = false;
    app.use((ctx) => {
      assert(ctx.state !== ctx.app.state);
      assertEquals(Object.entries(ctx.state).length, 0);
      ctx.state.b = "b";
      assertEquals(ctx.app.state.b, "string");
      called = true;
    });
    await app.listen({ port: 8000 });
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
      sign(_data: Data): string {
        return "";
      },
      verify(_data: Data, _digest: string): boolean {
        return true;
      },
      indexOf(_data: Data, _digest: string): number {
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
    const app = new Application({
      serverConstructor: MockServer,
      logErrors: false,
    });
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
    const app = new Application({
      serverConstructor: MockServer,
      logErrors: false,
    });
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
  name: "uncaught errors log by default",
  async fn() {
    const errorLogStack: any[][] = [];
    const originalConsoleError = Object.getOwnPropertyDescriptor(
      console,
      "error",
    );
    assert(originalConsoleError);
    Object.defineProperty(console, "error", {
      value(...args: any[]) {
        errorLogStack.push(args);
      },
      configurable: true,
    });
    const app = new Application({ serverConstructor: MockServer });
    serverRequestStack.push(createMockRequest());
    app.use((ctx) => {
      ctx.throw(404, "File Not Found");
    });
    await app.listen({ port: 8000 });
    Object.defineProperty(console, "error", originalConsoleError);
    assertEquals(errorLogStack.length, 4);
    assert(errorLogStack[0][0].startsWith("[uncaught oak error]"));
    teardown();
  },
});

test({
  name: "caught errors don't dispatch error events",
  async fn() {
    const app = new Application({ serverConstructor: MockServer });
    serverRequestStack.push(createMockRequest());
    const errStack: any[] = [];
    app.use(async (_ctx, next) => {
      try {
        await next();
      } catch (err) {
        errStack.push(err);
      }
    });
    app.use((ctx) => {
      ctx.throw(404, "File Not Found");
    });
    const errEventStack: ApplicationErrorEvent<any, any>[] = [];
    app.addEventListener("error", (evt) => {
      errEventStack.push(evt);
    });
    await app.listen({ port: 8000 });
    const [response] = requestResponseStack;
    assertEquals(response.status, 404);
    assertEquals(errStack.length, 1);
    assertEquals(errEventStack.length, 0);
    teardown();
  },
});

test({
  name: "thrown errors in a catch block",
  async fn() {
    const errors: ApplicationErrorEvent<any, any>[] = [];
    const app = new Application({
      serverConstructor: MockServer,
      logErrors: false,
    });
    serverRequestStack.push(createMockRequest());

    app.addEventListener("error", (evt) => {
      errors.push(evt);
    });

    app.use(async () => {
      let file: Deno.File | undefined;
      try {
        const filename = await Deno.makeTempFile();
        file = await Deno.open(filename, { read: true });
        file.close();
        file.close();
      } catch {
        if (file) {
          file.close();
        }
      }
    });

    await app.listen({ port: 8000 });
    const [response] = requestResponseStack;
    assertEquals(response.status, 500);
    assertEquals(errors.length, 1);
    assertEquals(errors[0].error.message, "Bad resource ID");
    teardown();
  },
});

test({
  name: "errors when generating server response",
  async fn() {
    const errors: ApplicationErrorEvent<any, any>[] = [];
    const app = new Application({
      serverConstructor: MockServer,
      logErrors: false,
    });
    serverRequestStack.push(createMockRequest());

    app.addEventListener("error", (evt) => {
      errors.push(evt);
    });

    app.use(async (ctx) => {
      ctx.response.body = { a: 4600119228n };
    });

    await app.listen({ port: 8000 });
    const [response] = requestResponseStack;
    assertEquals(response.status, 500);
    assertEquals(errors.length, 1);
    assertEquals(
      errors[0].error.message,
      "Do not know how to serialize a BigInt",
    );
    teardown();
  },
});

test({
  name: "errors when generating native response",
  async fn() {
    const errors: ApplicationErrorEvent<any, any>[] = [];
    const app = new Application({
      serverConstructor: MockNativeServer,
      logErrors: false,
    });
    nativeRequestStack.push(createMockNativeRequest());

    app.addEventListener("error", (evt) => {
      errors.push(evt);
    });

    app.use(async (ctx) => {
      ctx.response.body = { a: 4600119228n };
    });

    await app.listen({ port: 8000 });
    const [r] = nativeRequestResponseStack;
    const response = await r;
    assertEquals(response.status, 500);
    assertEquals(errors.length, 1);
    assertEquals(
      errors[0].error.message,
      "Do not know how to serialize a BigInt",
    );
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
      ctx.app.state.id = 4;
      ctx.app.state.session = 5;
      // @ts-expect-error
      ctx.app.state.bar = 6;
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
    assertEquals(await response.text(), "hello oak");
  },
});

test({
  name: "application .fetchEventHandler() - proxy handling",
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
      ctx.response.body = {
        ip: ctx.request.ip,
        ips: ctx.request.ips,
      };
      ctx.response.type = "json";
    });
    const handler = app.fetchEventHandler();
    const request = new Request("http://localhost:8000/", {
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1",
      },
    });
    await handler.handleEvent({ request, respondWith } as FetchEvent);
    assertEquals(respondCount, 1);
    assert(response);
    assertEquals(await response.json(), {
      ip: "127.0.0.1",
      ips: ["127.0.0.1", "192.168.0.1"],
    });
  },
});

test({
  name: "application .fetchEventHandler() - secure option",
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

    let middleware = (ctx: Context) => {
      ctx.response.body = { secure: ctx.request.secure };
      ctx.response.type = "json";
    };
    let app = new Application();
    app.use(middleware);
    let handler = app.fetchEventHandler();
    let request = new Request("https://localhost:8000/");
    await handler.handleEvent({ request, respondWith } as FetchEvent);
    assertEquals(respondCount, 1);
    assert(response);
    assertEquals(await response.json(), { secure: true });

    app = new Application();
    app.use(middleware);
    handler = app.fetchEventHandler({ secure: false });
    request = new Request("https://localhost:8000/");
    await handler.handleEvent({ request, respondWith } as FetchEvent);
    assertEquals(respondCount, 2);
    assert(response);
    assertEquals(await response.json(), { secure: false });
  },
});

test({
  name: "application.use() - type checking - at least one middleware is passed",
  fn() {
    const app = new Application();
    try {
      // @ts-expect-error
      app.use();
    } catch {
      //
    }
  },
});

test({
  name: "new Application() - HttpServerStd",
  fn() {
    new Application({
      serverConstructor: HttpServerStd,
    });
  },
});

test({
  name: "new Application() - HttpServerNative",
  fn() {
    new Application({
      serverConstructor: HttpServerNative,
    });
  },
});

test({
  name: "Application - inspecting",
  fn() {
    assertEquals(
      Deno.inspect(new Application()),
      `Application { "#middleware": [], keys: undefined, proxy: false, state: {} }`,
    );
  },
});
