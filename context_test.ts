// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "./test_deps.ts";
import type { Application, State } from "./application.ts";
import { Context } from "./context.ts";
import { Cookies } from "./cookies.ts";
import { errors } from "./deps.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import type {} from "./http_server_native.ts";
import { Request as OakRequest } from "./request.ts";
import { Response as OakResponse } from "./response.ts";
import { cloneState } from "./structured_clone.ts";
import type { UpgradeWebSocketFn, UpgradeWebSocketOptions } from "./types.d.ts";
import { isNode } from "./util.ts";

const { test } = Deno;

function createMockApp<S extends State = Record<string, any>>(
  state = {} as S,
): Application<S> {
  return {
    state,
    dispatchEvent() {},
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
  const requestEvent = {
    request,
    respondWith(r: Response | Promise<Response>) {
      respondWithStack.push(r);
      return Promise.resolve();
    },
  };
  const upgradeWebSocket: UpgradeWebSocketFn | undefined = upgradeUndefined
    ? undefined
    : (request, options) => {
      if (upgradeThrow) {
        throw new TypeError("Cannot upgrade connection.");
      }
      upgradeWebSocketStack.push([request, options]);
      return { response: mockResponse, socket: mockWebSocket };
    };
  return new NativeRequest(requestEvent, { upgradeWebSocket });
}

test({
  name: "context",
  fn() {
    const app = createMockApp();
    const serverRequest = createMockNativeRequest();
    const context = new Context(app, serverRequest, cloneState(app.state));
    assert(context instanceof Context);
    assertEquals(context.state, app.state);
    assertStrictEquals(context.app, app);
    assert(context.cookies instanceof Cookies);
    assert(context.request instanceof OakRequest);
    assert(context.response instanceof OakResponse);
  },
});

test({
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

test({
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

test({
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
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
    context.response.destroy();
  },
});

test({
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
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
    context.response.destroy();
  },
});

test({
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
  },
});

test({
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

test({
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

test({
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

test({
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

test({
  name: "context.getSSETarget()",
  async fn() {
    const context = new Context(createMockApp(), createMockNativeRequest(), {});
    const sse = context.sendEvents();
    sse.dispatchComment(`hello world`);
    await sse.close();
  },
});

test({
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

test({
  name: "Context - inspecting",
  fn() {
    const app = createMockApp();
    const req = createMockNativeRequest();
    assertEquals(
      Deno.inspect(new Context(app, req, {}), { depth: 1 }),
      isNode()
        ? `Context {\n  app: [MockApplication],\n  cookies: [Cookies],\n  isUpgradable: false,\n  respond: true,\n  request: [Request],\n  response: [Response],\n  socket: undefined,\n  state: {}\n}`
        : `Context {\n  app: MockApplication {},\n  cookies: Cookies [],\n  isUpgradable: false,\n  respond: true,\n  request: Request {\n  hasBody: false,\n  headers: Headers { host: "localhost" },\n  ip: "",\n  ips: [],\n  method: "GET",\n  secure: false,\n  url: "http://localhost/"\n},\n  response: Response { body: undefined, headers: Headers {}, status: 404, type: undefined, writable: true },\n  socket: undefined,\n  state: {}\n}`,
    );
  },
});
