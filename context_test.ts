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
  test,
} from "./test_deps.ts";
import type { Application, Locals, State } from "./application.ts";
import { Context } from "./context.ts";
import { Cookies } from "./cookies.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { httpErrors } from "./httpError.ts";
import type { ServerRequest } from "./types.d.ts";

function createMockApp<
  S extends State = Record<string, any>,
  L extends Locals = Record<string, any>,
>(
  state = {} as S,
): Application<S, L> {
  return {
    state,
    dispatchEvent() {},
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

function isDenoReader(value: any): value is Deno.Reader {
  return value && typeof value === "object" && "read" in value &&
    typeof value.read === "function";
}

test({
  name: "context",
  fn() {
    const app = createMockApp();
    const serverRequest = createMockServerRequest();
    const context = new Context(app, serverRequest);
    assert(context instanceof Context);
    assertStrictEquals(context.state, app.state);
    assertEquals(context.locals, {});
    assertStrictEquals(context.app, app);
    assert(context.cookies instanceof Cookies);
    assert(context.request instanceof Request);
    assert(context.response instanceof Response);
  },
});

test({
  name: "context.assert()",
  fn() {
    const context: Context = new Context(
      createMockApp(),
      createMockServerRequest(),
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
    const context = new Context(createMockApp(), createMockServerRequest());
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
    );
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({ root: "./fixtures" });
    const serverResponse = await context.response.toServerResponse();
    const bodyReader = serverResponse.body;
    assert(isDenoReader(bodyReader));
    const body = await Deno.readAll(bodyReader);
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
    const context = new Context(createMockApp(), createMockServerRequest());
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({ path: "/test.html", root: "./fixtures" });
    const serverResponse = context.response.toServerResponse();
    const bodyReader = (await serverResponse).body;
    assert(isDenoReader(bodyReader));
    const body = await Deno.readAll(bodyReader);
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
  name: "context.upgrade()",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest({
        headers: [["Upgrade", "websocket"], ["Sec-WebSocket-Key", "abc"]],
      }),
    );
    assert(context.socket === undefined);
    const ws = await context.upgrade();
    assert(ws);
    assert(context.socket === ws);
    assertEquals(context.respond, false);
  },
});

test({
  name: "context.upgrade() failure does not set socket/respond",
  async fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
    assert(context.socket === undefined);
    await assertThrowsAsync(async () => {
      await context.upgrade();
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
      createMockServerRequest({
        headers: [["Upgrade", "websocket"], ["Sec-WebSocket-Key", "abc"]],
      }),
    );
    assertEquals(context.isUpgradable, true);
  },
});

test({
  name: "context.isUpgradable false",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest({
        headers: [["Upgrade", "websocket"]],
      }),
    );
    assertEquals(context.isUpgradable, false);
  },
});

test({
  name: "context.getSSETarget()",
  async fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
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
      true,
    );
    assertEquals(context.request.secure, true);
  },
});
