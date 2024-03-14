// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import { assertEquals, assertStrictEquals, assertThrows } from "./test_deps.ts";
import type { Application, State } from "./application.ts";
import { Context } from "./context.ts";
import { assert, errors, SecureCookieMap, Status } from "./deps.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import type {} from "./http_server_native.ts";
import { Request as OakRequest } from "./request.ts";
import { Response as OakResponse } from "./response.ts";
import { cloneState } from "./structured_clone.ts";
import type { UpgradeWebSocketFn, UpgradeWebSocketOptions } from "./types.ts";
import { createPromiseWithResolvers, isNode } from "./util.ts";

function createMockApp<S extends State = Record<string, any>>(
  state = {} as S,
): Application<S> {
  let listeners: any[] = [];
  return {
    state,
    listeners,
    dispatchEvent() {},
    addEventListener(event: string) {
      listeners.push(event);
    },
    [Symbol.for("Deno.customInspect")]() {
      return `MockApplication {}`;
    },
    [Symbol.for("nodejs.util.inspect.custom")](
      depth: number,
      options: any,
      inspect: (value: unknown, options?: unknown) => string,
    ) {
      if (depth < 0) {
        return options.stylize(`[MockApplication]`, "special");
      }

      const newOptions = Object.assign({}, options, {
        depth: options.depth === null ? null : options.depth - 1,
      });
      return `${options.stylize("MockApplication", "special")} ${
        inspect({}, newOptions)
      }`;
    },
  } as any;
}

interface MockNativeOptions {
  url?: string;
  requestInit?: RequestInit;
  upgradeThrow?: boolean;
  upgradeUndefined?: boolean;
}

let respondWithStack: (Response | Promise<Response>)[] = [];
let upgradeWebSocketStack: [Request, UpgradeWebSocketOptions | undefined][] =
  [];

const mockWebSocket = {} as WebSocket;
const mockResponse = {} as Response;

function createMockNativeRequest(
  {
    url = "http://localhost/",
    requestInit = { headers: [["host", "localhost"]] },
    upgradeThrow = true,
    upgradeUndefined = false,
  }: MockNativeOptions = {},
) {
  respondWithStack = [];
  upgradeWebSocketStack = [];
  const request = new Request(url, requestInit);
  const upgradeWebSocket: UpgradeWebSocketFn | undefined = upgradeUndefined
    ? undefined
    : (request, options) => {
      if (upgradeThrow) {
        throw new TypeError("Cannot upgrade connection.");
      }
      upgradeWebSocketStack.push([request, options]);
      return { response: mockResponse, socket: mockWebSocket };
    };
  const nativeRequest = new NativeRequest(request, { upgradeWebSocket });
  const { promise, resolve } = createPromiseWithResolvers<Response>();
  respondWithStack.push(promise);
  nativeRequest.response.then((response) => resolve(response));
  return nativeRequest;
}

Deno.test({
  name: "context",
  fn() {
    const app = createMockApp();
    const serverRequest = createMockNativeRequest();
    const context = new Context(app, serverRequest, cloneState(app.state));
    assert(context instanceof Context);
    assertEquals(context.state, app.state);
    assertStrictEquals(context.app, app);
    assert(context.cookies instanceof SecureCookieMap);
    assert(context.request instanceof OakRequest);
    assert(context.request.source instanceof Request);
    assert(context.response instanceof OakResponse);
  },
});

Deno.test({
  name: "context.assert()",
  fn() {
    const context: Context = new Context(
      createMockApp(),
      createMockNativeRequest(),
      {},
    );
    assertThrows(
      () => {
        let loggedIn: string | undefined;
        context.assert(loggedIn, 401, "Unauthorized");
      },
      errors.Unauthorized,
      "Unauthorized",
    );
  },
});

Deno.test({
  name: "context.assert() headers",
  fn() {
    const context: Context = new Context(
      createMockApp(),
      createMockNativeRequest(),
      {},
    );
    assertThrows(
      () => {
        let loggedIn: string | undefined;
        context.assert(loggedIn, 401, "Unauthorized", {
          headers: new Headers({
            "WWW-Authenticate":
              'Bearer realm="oak-tests",error="invalid_token"',
          }),
        });
      },
      errors.Unauthorized,
      "Unauthorized",
    );
  },
});

Deno.test({
  name: "context.assert() expose",
  fn() {
    const context: Context = new Context(
      createMockApp(),
      createMockNativeRequest(),
      {},
    );
    assertThrows(
      () => {
        let loggedIn: string | undefined;
        context.assert(loggedIn, 401, "Unauthorized", {
          expose: true,
        });
      },
      errors.Unauthorized,
      "Unauthorized",
    );
  },
});

Deno.test({
  name: "context.assert() no redundant status",
  fn() {
    const context: Context = new Context(
      createMockApp(),
      createMockNativeRequest(),
      {},
    );
    assertThrows(
      () => {
        let loggedIn: string | undefined;
        context.assert(loggedIn, 401, "Unauthorized", {
          status: Status.Unauthorized,
        });
      },
      TypeError,
      "Cannot set property status of Error which has only a getter",
    );
  },
});

Deno.test({
  name: "context.throw()",
  fn() {
    const context = new Context(createMockApp(), createMockNativeRequest(), {});
    assertThrows(
      () => {
        context.throw(404, "foobar");
      },
      errors.NotFound,
      "foobar",
    );
  },
});

Deno.test({
  name: "context.send() default path",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockNativeRequest({ url: "http://localhost/test.html" }),
      {},
    );
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({ root: "./fixtures", maxbuffer: 0 });
    const response = await context.response.toDomResponse();
    const ab = await response.arrayBuffer();
    assertEquals(new Uint8Array(ab), fixture);
    assertEquals(context.response.type, ".html");
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
    context.response.destroy();
  },
});

Deno.test({
  name: "context.send() specified path",
  async fn() {
    const context = new Context(createMockApp(), createMockNativeRequest(), {});
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({
      path: "/test.html",
      root: "./fixtures",
      maxbuffer: 0,
    });
    const response = await context.response.toDomResponse();
    const ab = await response.arrayBuffer();
    assertEquals(new Uint8Array(ab), fixture);
    assertEquals(context.response.type, ".html");
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
    context.response.destroy();
  },
});

Deno.test({
  name: "context.upgrade()",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockNativeRequest({
        url: "http://localhost/",
        requestInit: {
          headers: [
            ["upgrade", "websocket"],
            ["sec-websocket-key", "abc"],
            ["host", "localhost"],
          ],
        },
        upgradeThrow: false,
      }),
      {},
    );
    assert(context.socket === undefined);
    const ws = context.upgrade();
    assert(ws);
    assertStrictEquals(context.socket, ws);
    assertStrictEquals(ws, mockWebSocket);
    assertEquals(context.respond, false);
    assertEquals(respondWithStack.length, 1);
    assertStrictEquals(await respondWithStack[0], mockResponse);
    assertEquals(upgradeWebSocketStack.length, 1);
    assertEquals((context.app as any).listeners, ["close"]);
  },
});

Deno.test({
  name: "context.upgrade() - not supported",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockNativeRequest({
        url: "http://localhost/",
        requestInit: {
          headers: [
            ["upgrade", "websocket"],
            ["sec-websocket-key", "abc"],
            ["host", "localhost"],
          ],
        },
        upgradeUndefined: true,
      }),
      {},
    );
    assert(context.socket === undefined);
    assertThrows(
      () => {
        context.upgrade();
      },
      TypeError,
      "Upgrading web sockets not supported.",
    );
    assert(context.socket === undefined);
    assertEquals(context.respond, true);
  },
});

Deno.test({
  name: "context.upgrade() failure does not set socket/respond",
  async fn() {
    const context = new Context(createMockApp(), createMockNativeRequest(), {});
    assert(context.socket === undefined);
    assertThrows(() => {
      context.upgrade();
    });
    assert(context.socket === undefined);
    assertEquals(context.respond, true);
  },
});

Deno.test({
  name: "context.isUpgradable true",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockNativeRequest({
        url: "http://localhost/",
        requestInit: {
          headers: [
            ["upgrade", "websocket"],
            ["sec-websocket-key", "abc"],
            ["host", "localhost"],
          ],
        },
      }),
      {},
    );
    assertEquals(context.isUpgradable, true);
  },
});

Deno.test({
  name: "context.isUpgradable false",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockNativeRequest({
        url: "http://localhost/",
        requestInit: {
          headers: [
            ["upgrade", "websocket"],
          ],
        },
      }),
      {},
    );
    assertEquals(context.isUpgradable, false);
  },
});

Deno.test({
  name: "context.sendEvents()",
  async fn() {
    const context = new Context(createMockApp(), createMockNativeRequest(), {});
    const sse = await context.sendEvents();
    assertEquals((context.app as any).listeners, ["close"]);
    sse.dispatchComment(`hello world`);
    await sse.close();
  },
});

Deno.test({
  name: "context create secure",
  fn() {
    const context = new Context(
      createMockApp(),
      createMockNativeRequest(),
      {},
      { secure: true },
    );
    assertEquals(context.request.secure, true);
  },
});

Deno.test({
  name: "Context - inspecting",
  fn() {
    const app = createMockApp();
    const req = createMockNativeRequest();
    assertEquals(
      Deno.inspect(new Context(app, req, {}), { depth: 1 }),
      isNode()
        ? `Context {\n  app: [MockApplication],\n  cookies: [SecureCookieMap],\n  isUpgradable: false,\n  respond: true,\n  request: [Request],\n  response: [Response],\n  socket: undefined,\n  state: {}\n}`
        : `Context {\n  app: MockApplication {},\n  cookies: SecureCookieMap [],\n  isUpgradable: false,\n  respond: true,\n  request: Request {\n  body: Body { has: false, used: false },\n  hasBody: false,\n  headers: Headers { host: "localhost" },\n  ip: "",\n  ips: [],\n  method: "GET",\n  secure: false,\n  url: "http://localhost/",\n  userAgent: UserAgent {\n  browser: { name: undefined, version: undefined, major: undefined },\n  cpu: { architecture: undefined },\n  device: { model: undefined, type: undefined, vendor: undefined },\n  engine: { name: undefined, version: undefined },\n  os: { name: undefined, version: undefined },\n  ua: ""\n}\n},\n  response: Response {\n  body: undefined,\n  headers: Headers {},\n  status: 404,\n  type: undefined,\n  writable: true\n},\n  socket: undefined,\n  state: {}\n}`,
    );
  },
});
