// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
  assertThrowsAsync,
  BufReader,
  BufWriter,
} from "./test_deps.ts";
import type { Application, State } from "./application.ts";
import { Context } from "./context.ts";
import { Cookies } from "./cookies.ts";
import { readAll } from "./deps.ts";
import { NativeRequest } from "./http_server_native.ts";
import type { UpgradeWebSocketFn } from "./http_server_native.ts";
import type { ServerRequest } from "./http_server_std.ts";
import { Request as OakRequest } from "./request.ts";
import { Response as OakResponse } from "./response.ts";
import { cloneState } from "./structured_clone.ts";
import { httpErrors } from "./httpError.ts";
import { WebSocketShim } from "./websocket.ts";
import type { UpgradeWebSocketOptions } from "./websocket.ts";

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
  } as any;
}

interface MockServerOptions {
  headers?: [string, string][];
  proto?: string;
  url?: string;
}

function createMockServerRequest(
  {
    url = "/",
    proto = "HTTP/1.1",
    headers: headersInit = [["host", "localhost"]],
  }: MockServerOptions = {},
): ServerRequest {
  const headers = new Headers(headersInit);
  return {
    conn: {
      close() {},
    },
    r: new BufReader(new Deno.Buffer(new Uint8Array())),
    w: new BufWriter(new Deno.Buffer(new Uint8Array())),
    headers,
    method: "GET",
    proto,
    url,
    async respond() {},
  } as any;
}

interface MockNativeOptions {
  url?: string;
  requestInit?: RequestInit;
  undefinedUpgrade?: boolean;
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
    undefinedUpgrade = false,
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
  const upgradeWebSocket: UpgradeWebSocketFn | undefined = undefinedUpgrade
    ? undefined
    : (request, options) => {
      upgradeWebSocketStack.push([request, options]);
      return { response: mockResponse, websocket: mockWebSocket };
    };
  return new NativeRequest(requestEvent, { upgradeWebSocket });
}

function isDenoReader(value: any): value is Deno.Reader {
  return value && typeof value === "object" && "read" in value &&
    typeof value.read === "function";
}

test({
  name: "context",
  fn() {
    const app = createMockApp();
    const serverRequest = createMockServerRequest();
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
      createMockServerRequest(),
      {},
    );
    assertThrows(
      () => {
        let loggedIn: string | undefined;
        context.assert(loggedIn, 401, "Unauthorized");
      },
      httpErrors.Unauthorized,
      "Unauthorized",
    );
  },
});

test({
  name: "context.throw()",
  fn() {
    const context = new Context(createMockApp(), createMockServerRequest(), {});
    assertThrows(
      () => {
        context.throw(404, "foobar");
      },
      httpErrors.NotFound,
      "foobar",
    );
  },
});

test({
  name: "context.send() default path",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest({ url: "/test.html" }),
      {},
    );
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({ root: "./fixtures", maxbuffer: 0 });
    const serverResponse = await context.response.toServerResponse();
    const bodyReader = serverResponse.body;
    assert(isDenoReader(bodyReader));
    const body = await readAll(bodyReader);
    assertEquals(body, fixture);
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
    const context = new Context(createMockApp(), createMockServerRequest(), {});
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({
      path: "/test.html",
      root: "./fixtures",
      maxbuffer: 0,
    });
    const serverResponse = context.response.toServerResponse();
    const bodyReader = (await serverResponse).body;
    assert(isDenoReader(bodyReader));
    const body = await readAll(bodyReader);
    assertEquals(body, fixture);
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
  name: "context.upgrade() - std Request",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest({
        headers: [["Upgrade", "websocket"], ["Sec-WebSocket-Key", "abc"], [
          "host",
          "localhost",
        ]],
      }),
      {},
    );
    assert(context.socket === undefined);
    const ws = await context.upgrade();
    assert(ws);
    assert(ws instanceof WebSocketShim);
    assertStrictEquals(context.socket, ws);
    assertEquals(context.respond, false);
  },
});

test({
  name: "context.upgrade() - native request",
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
    assert(context.socket === undefined);
    const ws = await context.upgrade();
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
        undefinedUpgrade: true,
      }),
      {},
    );
    assert(context.socket === undefined);
    await assertThrowsAsync(
      async () => {
        await context.upgrade();
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
    const context = new Context(createMockApp(), createMockServerRequest(), {});
    assert(context.socket === undefined);
    await assertThrowsAsync(async () => {
      await context.upgrade();
    });
    assert(context.socket === undefined);
    assertEquals(context.respond, true);
  },
});

test({
  name: "context.isUpgradable true - std request",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest({
        headers: [["Upgrade", "websocket"], ["Sec-WebSocket-Key", "abc"]],
      }),
      {},
    );
    assertEquals(context.isUpgradable, true);
  },
});

test({
  name: "context.isUpgradable true - native request",
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
  name: "context.isUpgradable false - std request",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest({
        headers: [["Upgrade", "websocket"]],
      }),
      {},
    );
    assertEquals(context.isUpgradable, false);
  },
});

test({
  name: "context.isUpgradable false - native request",
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
    const context = new Context(createMockApp(), createMockServerRequest(), {});
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
      createMockServerRequest(),
      {},
      true,
    );
    assertEquals(context.request.secure, true);
  },
});

test({
  name: "Context - inspecting",
  fn() {
    const app = createMockApp();
    const req = createMockServerRequest();
    assertEquals(
      Deno.inspect(new Context(app, req, {}), { depth: 1 }),
      `Context {\n  app: MockApplication {},\n  cookies: Cookies [],\n  isUpgradable: false,\n  respond: true,\n  request: Request {\n  hasBody: false,\n  headers: Headers { host: "localhost" },\n  ip: "",\n  ips: [],\n  method: "GET",\n  secure: false,\n  url: "http://localhost/"\n},\n  response: Response { body: undefined, headers: Headers {}, status: 404, type: undefined, writable: true },\n  socket: undefined,\n  state: {}\n}`,
    );
  },
});
