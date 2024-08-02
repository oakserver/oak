// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "./deps_test.ts";

import { Application } from "./application.ts";
import type {
  ApplicationErrorEvent,
  ListenOptions,
  ListenOptionsTls,
  State,
} from "./application.ts";
import { Context } from "./context.ts";
import { assert, errors, KeyStack, Status } from "./deps.ts";
import { Server } from "./http_server_native.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import type {
  Data,
  Listener,
  OakServer,
  ServeOptions,
  ServerConstructor,
  ServerRequest,
  ServeTlsOptions,
} from "./types.ts";
import { isNode } from "./utils/type_guards.ts";
import { createPromiseWithResolvers } from "./utils/create_promise_with_resolvers.ts";

let optionsStack: Array<ListenOptions | ListenOptionsTls> = [];
let serverClosed = false;

function teardown() {
  optionsStack = [];
  serverClosed = false;
}

function setup(
  ...requests: ([string?, RequestInit?])[]
): [ServerConstructor<NativeRequest>, Response[]] {
  const responseStack: Response[] = [];

  function createRequest(
    url = "http://localhost/index.html",
    requestInit?: RequestInit,
  ): NativeRequest {
    const request = new Request(url, requestInit);

    const nativeRequest = new NativeRequest(request, {});
    nativeRequest.response.then((response) => responseStack.push(response));
    return nativeRequest;
  }

  const mockRequests = requests.map((r) => createRequest(...r));

  return [
    class MockNativeServer<AS extends State = Record<string, any>>
      implements OakServer<ServerRequest> {
      constructor(
        _app: Application<AS>,
        private options: ServeOptions | ServeTlsOptions,
      ) {
        optionsStack.push(options);
      }

      close(): Promise<void> {
        serverClosed = true;
        return Promise.resolve();
      }

      listen(): Listener {
        this.options.signal?.addEventListener(
          "abort",
          () => serverClosed = true,
        );
        return {
          addr: {
            transport: "tcp",
            hostname: this.options.hostname ?? "localhost",
            port: this.options.port,
          },
        } as Listener;
      }

      async *[Symbol.asyncIterator]() {
        for await (const request of mockRequests) {
          yield request;
        }
      }
    },
    responseStack,
  ];
}

function setupClosed(
  ...requests: ([string?, RequestInit?])[]
): [ServerConstructor<NativeRequest>, Response[]] {
  const responseStack: Response[] = [];

  function createRequest(
    url = "http://localhost/index.html",
    requestInit?: RequestInit,
  ): NativeRequest {
    const request = new Request(url, requestInit);

    Object.defineProperty(request, "headers", {
      get() {
        throw new TypeError("cannot read headers: request closed");
      },
    });

    const nativeRequest = new NativeRequest(request, {});
    nativeRequest.response.then((response) => responseStack.push(response));
    return nativeRequest;
  }

  const mockRequests = requests.map((r) => createRequest(...r));

  return [
    class MockNativeServer<AS extends State = Record<string, any>>
      implements OakServer<ServerRequest> {
      constructor(
        _app: Application<AS>,
        private options: Omit<ServeOptions | ServeTlsOptions, "signal">,
      ) {
        optionsStack.push(options);
      }

      close(): void {
        serverClosed = true;
      }

      listen(): Listener {
        return {
          addr: {
            transport: "tcp",
            hostname: this.options.hostname ?? "localhost",
            port: this.options.port,
          },
        } as Listener;
      }

      async *[Symbol.asyncIterator]() {
        for await (const request of mockRequests) {
          yield request;
        }
      }
    },
    responseStack,
  ];
}

Deno.test({
  name: "construct App()",
  fn() {
    const app = new Application();
    assert(app instanceof Application);
    teardown();
  },
});

Deno.test({
  name: "register middleware",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({ serverConstructor });
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

Deno.test({
  name: "register middleware - accepts non void",
  fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    app.use((ctx) => ctx.response.body = "hello world");
    teardown();
  },
});

Deno.test({
  name: "middleware execution order 1",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({ serverConstructor });
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

Deno.test({
  name: "middleware execution order 2",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({ serverConstructor });
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

Deno.test({
  name: "middleware execution order 3",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({ serverConstructor });
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

Deno.test({
  name: "middleware execution order 4",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({ serverConstructor });
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

Deno.test({
  name: "app.listen",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    app.use(() => {});
    await app.listen("127.0.0.1:8080");
    assertEquals(optionsStack, [{
      hostname: "127.0.0.1",
      port: 8080,
    }]);
    teardown();
  },
});

Deno.test({
  name: "app.listen native",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    app.use(() => {});
    await app.listen("127.0.0.1:8080");
    assertEquals(optionsStack, [{ hostname: "127.0.0.1", port: 8080 }]);
    teardown();
  },
});

Deno.test({
  name: "app.listen IPv6 Loopback",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    app.use(() => {});
    await app.listen("[::1]:8080");
    assertEquals(optionsStack, [{ hostname: "::1", port: 8080 }]);
    teardown();
  },
});

Deno.test({
  name: "app.listen(options)",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    app.use(() => {});
    await app.listen({ port: 8000 });
    assertEquals(optionsStack, [{ port: 8000 }]);
    teardown();
  },
});

Deno.test({
  name: "app.listenTLS",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    app.use(() => {});
    await app.listen({
      port: 8000,
      secure: true,
      certFile: "",
      keyFile: "",
    });
    assertEquals(optionsStack, [{
      port: 8000,
      secure: true,
      certFile: "",
      keyFile: "",
    }]);
    teardown();
  },
});

Deno.test({
  name: "app.state",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application<{ foo?: string }>({
      state: {},
      serverConstructor,
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

Deno.test({
  name: "app - contextState - clone",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({
      contextState: "clone",
      state: {
        a() {},
        b: "string",
        c: /c/,
      },
      serverConstructor,
    });
    let called = false;
    app.use((ctx) => {
      // @ts-ignore we shouldn't have type inference in asserts!
      assertEquals(ctx.state, { b: "string", c: /c/ });
      assert(ctx.state !== ctx.app.state);
      called = true;
    });
    await app.listen({ port: 8000 });
    assert(called);
    teardown();
  },
});

Deno.test({
  name: "app - contextState - prototype",
  async fn() {
    const state = {
      a: "a",
      b: { c: "c" },
    };
    const [serverConstructor] = setup([]);
    const app = new Application({
      contextState: "prototype",
      state,
      serverConstructor,
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

Deno.test({
  name: "app - contextState - alias",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({
      contextState: "alias",
      state: {
        a() {},
        b: "string",
        c: /c/,
      },
      serverConstructor,
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

Deno.test({
  name: "app - contextState - empty",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({
      contextState: "empty",
      state: {
        a() {},
        b: "string",
        c: /c/,
      },
      serverConstructor,
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

Deno.test({
  name: "app.keys undefined",
  fn() {
    const app = new Application();
    assertEquals(app.keys, undefined);
    teardown();
  },
});

Deno.test({
  name: "app.keys passed as array",
  fn() {
    const app = new Application({ keys: ["foo"] });
    assert(app.keys instanceof KeyStack);
    teardown();
  },
});

Deno.test({
  name: "app.keys passed as KeyStack-like",
  fn() {
    const keys = {
      sign(_data: Data) {
        return Promise.resolve("");
      },
      verify(_data: Data, _digest: string) {
        return Promise.resolve(true);
      },
      indexOf(_data: Data, _digest: string) {
        return Promise.resolve(0);
      },
    } as KeyStack;
    const app = new Application({ keys });
    assert(app.keys === keys);
    teardown();
  },
});

Deno.test({
  name: "app.keys set as array",
  fn() {
    const app = new Application();
    app.keys = ["foo"];
    assert(app.keys instanceof KeyStack);
    teardown();
  },
});

Deno.test({
  name: "app.listen({ signal }) no requests in flight",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    const abortController = new AbortController();
    app.use(() => {});
    const p = app.listen({ port: 8000, signal: abortController.signal });
    abortController.abort();
    await p;
    assertEquals(serverClosed, true);
    teardown();
  },
});

Deno.test({
  name: "app.listen({ signal }) requests in flight",
  async fn() {
    const [serverConstructor] = setup([], [], [], [], []);
    const app = new Application({ serverConstructor });
    const abortController = new AbortController();
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

Deno.test({
  name: "app.addEventListener()",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({
      serverConstructor,
      logErrors: false,
    });
    app.addEventListener("error", (evt) => {
      assert(evt.error instanceof errors.InternalServerError);
    });
    app.use((ctx) => {
      ctx.throw(500, "oops!");
    });
    await app.listen({ port: 8000 });
    teardown();
  },
});

Deno.test({
  name: "app emits close event",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
    let closeFired = false;
    app.addEventListener("close", () => {
      closeFired = true;
    });
    const abortController = new AbortController();
    app.use(() => {});
    const p = app.listen({ port: 8000, signal: abortController.signal });
    abortController.abort();
    await p;
    assert(closeFired);
    teardown();
  },
});

Deno.test({
  name: "closed native request is handled properly",
  async fn() {
    const [serverConstructor] = setupClosed([]);
    const app = new Application({ serverConstructor, logErrors: false });
    app.use((ctx) => {
      ctx.throw(500, "oops!");
    });
    const errors: string[] = [];
    app.addEventListener("error", ({ context, message }) => {
      assert(!context);
      errors.push(message);
    });
    await app.listen({ port: 8000 });
    teardown();
    assertEquals(errors, ["cannot read headers: request closed"]);
  },
});

Deno.test({
  name: "uncaught errors impact response",
  async fn() {
    const [serverConstructor, responseStack] = setup([]);
    const app = new Application({ serverConstructor, logErrors: false });
    app.use((ctx) => {
      ctx.throw(404, "File Not Found");
    });
    await app.listen({ port: 8000 });
    const [response] = responseStack;
    assertEquals(response.status, 404);
    teardown();
  },
});

Deno.test({
  name: "uncaught errors clear headers properly",
  async fn() {
    const [serverConstructor, responseStack] = setup([]);
    const app = new Application({
      serverConstructor,
      logErrors: false,
    });
    app.use((ctx) => {
      ctx.response.headers.append("a", "b");
      ctx.response.headers.append("b", "c");
      ctx.response.headers.append("c", "d");
      ctx.response.headers.append("d", "e");
      ctx.response.headers.append("f", "g");
      ctx.throw(500, "Internal Error");
    });
    await app.listen({ port: 8000 });
    const [response] = responseStack;
    assertEquals([...response.headers], [[
      "content-type",
      "text/plain; charset=UTF-8",
    ]]);
    teardown();
  },
});

Deno.test({
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
    const [serverConstructor] = setup([]);
    const app = new Application({ serverConstructor });
    app.use((ctx) => {
      ctx.throw(404, "File Not Found");
    });
    await app.listen({ port: 8000 });
    Object.defineProperty(console, "error", originalConsoleError);
    assertEquals(errorLogStack.length, 4);
    assert(errorLogStack[0][0].startsWith("[uncaught application error]"));
    teardown();
  },
});

Deno.test({
  name: "errors call event handler properly",
  async fn() {
    const [serverConstructor, responseStack] = setup([]);
    const app = new Application({ serverConstructor, logErrors: false });
    app.use((ctx) => {
      ctx.throw(400, "Bad Request");
    });
    const errStatusStack: (Status | undefined)[] = [];
    app.addEventListener("error", (evt) => {
      errStatusStack.push(evt.context?.response.status);
    });
    await app.listen({ port: 8000 });
    const [response] = responseStack;
    assertEquals(response.status, 400);
    assertEquals(errStatusStack.length, 1);
    assertEquals(errStatusStack[0], Status.BadRequest);
    teardown();
  },
});

Deno.test({
  name: "caught errors don't dispatch error events",
  async fn() {
    const [serverConstructor, responseStack] = setup([]);
    const app = new Application({ serverConstructor });
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
    const [response] = responseStack;
    assertEquals(response.status, 404);
    assertEquals(errStack.length, 1);
    assertEquals(errEventStack.length, 0);
    teardown();
  },
});

Deno.test({
  name: "thrown errors in a catch block",
  async fn() {
    const errors: ApplicationErrorEvent<any, any>[] = [];
    const [serverConstructor, responseStack] = setup([]);
    const app = new Application({
      serverConstructor,
      logErrors: false,
    });

    app.addEventListener("error", (evt) => {
      errors.push(evt);
    });

    app.use(async () => {
      try {
        throw new Error("catch me");
      } catch {
        throw new Error("caught");
      }
    });

    await app.listen({ port: 8000 });
    const [response] = responseStack;
    assertEquals(response.status, 500);
    assertEquals(errors.length, 1);
    assertEquals(errors[0].error.message, "caught");
    teardown();
  },
});

Deno.test({
  name: "errors when generating native response",
  async fn() {
    const [serverConstructor, responseStack] = setup([]);
    const errors: ApplicationErrorEvent<any, any>[] = [];
    const app = new Application({
      serverConstructor,
      logErrors: false,
    });

    app.addEventListener("error", (evt) => {
      errors.push(evt);
    });

    app.use(async (ctx) => {
      ctx.response.body = { a: 4600119228n };
    });

    await app.listen({ port: 8000 });
    const [response] = responseStack;
    assertEquals(response.status, 500);
    assertEquals(errors.length, 1);
    assertEquals(
      errors[0].error.message,
      "Do not know how to serialize a BigInt",
    );
    teardown();
  },
});

Deno.test({
  name: "app.listen() without middleware",
  async fn() {
    const [serverConstructor] = setup([]);
    const app = new Application({ serverConstructor });
    await assertRejects(async () => {
      await app.listen(":8000");
    }, TypeError);
    teardown();
  },
});

Deno.test({
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
    teardown();
  },
});

Deno.test({
  name: "application listen event",
  async fn() {
    const [serverConstructor] = setup();
    const app = new Application({ serverConstructor });
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

Deno.test({
  name: "application doesn't respond on ctx.respond === false",
  async fn() {
    const [serverConstructor, responseStack] = setup([]);
    const app = new Application({ serverConstructor });
    app.use((ctx) => {
      ctx.respond = false;
    });
    await app.listen({ port: 8000 });
    assertEquals(responseStack.length, 0);
    teardown();
  },
});

Deno.test({
  name: "application passes proxy",
  async fn() {
    const [serverConstructor, responseStack] = setup([
      "http://localhost/index.html",
      {
        headers: {
          "host": "10.255.255.255",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "10.10.10.10, 192.168.1.1, 10.255.255.255",
          "x-forwarded-host": "10.10.10.10",
        },
      },
    ]);
    const app = new Application({
      serverConstructor,
      proxy: true,
    });
    let called = false;
    app.use((ctx) => {
      called = true;
      assertEquals(String(ctx.request.url), "https://10.10.10.10/index.html");
    });
    await app.listen({ port: 8000 });
    assert(called);
    assertEquals(responseStack.length, 1);
    teardown();
  },
});

Deno.test({
  name: "application .handle()",
  async fn() {
    const app = new Application();
    let called = 0;
    app.use((context, next) => {
      assert(context instanceof Context);
      assertEquals(typeof next, "function");
      called++;
    });
    const actual = await app.handle(new Request("http://localhost/index.html"));
    assertEquals(called, 1);
    assert(actual);
    assertEquals(actual.body, null);
    assertEquals(actual.status, Status.NotFound);
    assertEquals([...actual.headers], [["content-length", "0"]]);
    teardown();
  },
});

Deno.test({
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
    const remoteAddr = {
      transport: "tcp",
      hostname: "example.com",
      port: 4747,
    } as const;
    const actual = await app.handle(request, remoteAddr);
    assertEquals(called, 1);
    assert(actual instanceof Response);
    assertEquals(actual.body, null);
    assertEquals(actual.status, Status.NotFound);
    assertEquals([...actual.headers], [["content-length", "0"]]);
    teardown();
  },
});

Deno.test({
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
    teardown();
  },
});

Deno.test({
  name: "application .handle() no response",
  async fn() {
    const app = new Application();
    app.use((context) => {
      context.respond = false;
    });
    const actual = await app.handle(new Request("http://localhost/index.html"));
    assertEquals(actual, undefined);
    teardown();
  },
});

Deno.test({
  name: "application .handle() no middleware throws",
  async fn() {
    const app = new Application();
    await assertRejects(async () => {
      await app.handle(new Request("http://localhost/index.html"));
    }, TypeError);
    teardown();
  },
});

function isBigInitValue(value: unknown): value is { __bigint: string } {
  return value != null && typeof value === "object" && "__bigint" in value &&
    typeof (value as any).__bigint === "string";
}

Deno.test({
  name: "application - json reviver is passed",
  async fn() {
    let called = 0;
    const app = new Application({
      jsonBodyReviver(_, value, ctx) {
        assert(ctx);
        called++;
        if (isBigInitValue(value)) {
          return BigInt(value.__bigint);
        } else {
          return value;
        }
      },
    });
    app.use(async (ctx) => {
      const body = ctx.request.body;
      assert(body.type() === "json");
      const actual = await body.json();
      assertEquals(actual, { a: 123456n });
      ctx.response.body = {};
      called++;
    });
    const body = JSON.stringify({
      a: {
        __bigint: "123456",
      },
    });
    const actual = await app.handle(
      new Request("http://localhost/index.html", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(body.length),
        },
        body,
      }),
    );
    assertEquals(called, 4);
    assertEquals(actual?.status, 200);
  },
});

Deno.test({
  name: "application - json replacer is passed",
  async fn() {
    let called = 0;
    const app = new Application({
      jsonBodyReplacer(_, value, ctx) {
        assert(ctx);
        called++;
        return typeof value === "bigint"
          ? { __bigint: value.toString(10) }
          : value;
      },
    });
    app.use(async (ctx) => {
      ctx.response.body = { a: 123456n };
    });
    const actual = await app.handle(new Request("http://localhost/index.html"));
    assertEquals(called, 3);
    const body = await actual?.json();
    assertEquals(body, { a: { __bigint: "123456" } });
  },
});

Deno.test({
  name: "application.use() - type checking - at least one middleware is passed",
  fn() {
    const app = new Application();
    try {
      // @ts-expect-error
      app.use();
    } catch {
      //
    }
    teardown();
  },
});

Deno.test({
  name: "new Application() - HttpServerNative",
  fn() {
    new Application({ serverConstructor: Server });
    teardown();
  },
});

Deno.test({
  name: "Application - inspecting",
  fn() {
    assertEquals(
      Deno.inspect(new Application()),
      isNode()
        ? `Application { '#middleware': [], keys: undefined, proxy: false, state: {} }`
        : `Application { "#middleware": [], keys: undefined, proxy: false, state: {} }`,
    );
    teardown();
  },
});

Deno.test({
  name: "Application.listen() - no options",
  // ignore: isNode(),
  ignore: true, // there is a challenge with serve and the abort controller that
  // needs to be isolated
  async fn() {
    const controller = new AbortController();
    const app = new Application();
    app.use((ctx) => {
      ctx.response.body = "hello world";
    });
    const { signal } = controller;
    const p = app.listen({ signal });
    controller.abort();
    await p;
    teardown();
  },
});

Deno.test({
  name: "Application load correct default server",
  ignore: isNode(), // this just hangs on node, because we can't close down
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const app = new Application();
    const { promise, resolve, reject } = createPromiseWithResolvers<void>();
    app.addEventListener("listen", ({ serverType }) => {
      try {
        assertEquals(serverType, isNode() ? "node" : "native");
      } catch (e) {
        reject(e);
      }
      resolve();
    });
    app.use((_ctx) => {});
    app.listen();
    teardown();
    return promise;
  },
});
