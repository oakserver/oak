// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import { assert, assertEquals, BufWriter, StringWriter } from "./test_deps.ts";

import type { Application } from "./application.ts";
import { Context } from "./context.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import { ServerSentEvent, SSEStreamTarget } from "./server_sent_event.ts";
import { isNode } from "./util.ts";

const { test } = Deno;

const preamble = `HTTP/1.1 200 OK
cache-control: no-cache
connection: Keep-Alive
content-type: text/event-stream
keep-alive: timeout=9007199254740991

`;

const env = {
  appTarget: new EventTarget(),
  appErrorEvents: [] as ErrorEvent[],
  outWriter: new StringWriter(),
  connCloseCalled: false,
  response: undefined as (Response | undefined),
};

function createMockApp(): Application {
  env.appTarget = new EventTarget();
  env.appErrorEvents = [];
  env.appTarget.addEventListener(
    "error",
    (evt) => {
      env.appErrorEvents.push(evt as ErrorEvent);
    },
  );
  return env.appTarget as any;
}

function createMockNativeRequest(): NativeRequest {
  env.response = undefined;
  return new NativeRequest({
    request: new Request("http://localhost:8000/"),
    async respondWith(p: Response | Promise<Response>) {
      env.response = await p;
    },
  }, {} as any);
}

test({
  name: "ServerSentEvent - construction",
  fn() {
    const evt = new ServerSentEvent("message", "foobar");
    assertEquals(evt.type, "message");
    assertEquals(evt.data, "foobar");
    assertEquals(evt.id, undefined);
    assertEquals(String(evt), `event: message\ndata: foobar\n\n`);
  },
});

test({
  name: "ServerSentEvent - data coercion",
  fn() {
    const evt = new ServerSentEvent("ping", { hello: true });
    assertEquals(evt.type, "ping");
    assertEquals(evt.data, `{"hello":true}`);
    assertEquals(evt.id, undefined);
    assertEquals(String(evt), `event: ping\ndata: {"hello":true}\n\n`);
  },
});

test({
  name: "ServerSentEvent - init id",
  fn() {
    const evt = new ServerSentEvent("ping", "foobar", { id: 1234 });
    assertEquals(evt.type, "ping");
    assertEquals(evt.data, `foobar`);
    assertEquals(evt.id, 1234);
    assertEquals(
      String(evt),
      `event: ping\nid: 1234\ndata: foobar\n\n`,
    );
  },
});

test({
  name: "ServerSentEvent - data space",
  fn() {
    const evt = new ServerSentEvent("ping", { hello: [1, 2, 3] }, { space: 2 });
    assertEquals(evt.type, "ping");
    assertEquals(evt.data, `{\n  "hello": [\n    1,\n    2,\n    3\n  ]\n}`);
    assertEquals(
      String(evt),
      `event: ping\ndata: {\ndata:   "hello": [\ndata:     1,\ndata:     2,\ndata:     3\ndata:   ]\ndata: }\n\n`,
    );
  },
});

test({
  name: "ServerSentEvent - __message",
  fn() {
    const evt = new ServerSentEvent("__message", { hello: "world" });
    assertEquals(evt.type, "__message");
    assertEquals(evt.data, `{"hello":"world"}`);
    assertEquals(String(evt), `data: {"hello":"world"}\n\n`);
  },
});

test({
  name: "SSEStreamTarget - construction",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    const sse = new SSEStreamTarget(context);
    assertEquals(sse.closed, false);
    await request.respond(await context.response.toDomResponse());
    await sse.close();
    assert(env.response);
    assert(env.response.body);
    const reader = (env.response.body as any).getReader();
    await reader.closed;
    assertEquals(env.response.status, 200);
    assertEquals(env.response.headers.get("content-type"), "text/event-stream");
    assertEquals(env.response.headers.get("connection"), "Keep-Alive");
    assertEquals(
      env.response.headers.get("keep-alive"),
      "timeout=9007199254740991",
    );
  },
});

test({
  name: "SSEStreamTarget - construction with headers",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    const sse = new SSEStreamTarget(
      context,
      {
        headers: new Headers([["X-Oak", "test"], ["Cache-Control", "special"]]),
      },
    );
    await request.respond(await context.response.toDomResponse());
    await sse.close();
    assert(env.response);
    assertEquals(env.response.headers.get("content-type"), "text/event-stream");
    assertEquals(env.response.headers.get("connection"), "Keep-Alive");
    assertEquals(env.response.headers.get("x-oak"), "test");
    assertEquals(env.response.headers.get("cache-control"), "no-cache");
  },
});

test({
  name: "SSEStreamTarget - dispatchEvent",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    const sse = new SSEStreamTarget(context);
    await request.respond(await context.response.toDomResponse());
    const evt = new ServerSentEvent("message", "foobar");
    sse.dispatchEvent(evt);
    await sse.close();
    assert(env.response);
    assertEquals(await env.response.text(), "event: message\ndata: foobar\n\n");
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStreamTarget - dispatchMessage",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    const sse = new SSEStreamTarget(context);
    await request.respond(await context.response.toDomResponse());
    sse.dispatchMessage("foobar");
    await sse.close();
    assert(env.response);
    assertEquals(await env.response.text(), "data: foobar\n\n");
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStreamTarget - dispatchComment",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    const sse = new SSEStreamTarget(context);
    await request.respond(await context.response.toDomResponse());
    sse.dispatchComment("foobar");
    await sse.close();
    assert(env.response);
    assertEquals(await env.response.text(), ": foobar\n\n");
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStreamTarget - keep-alive setting",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    const sse = new SSEStreamTarget(context, { keepAlive: 1000 });
    await request.respond(await context.response.toDomResponse());
    const p = new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        try {
          await sse.close();
          assert(env.response);
          assertEquals(await env.response.text(), ": keep-alive comment\n\n");
          assertEquals(env.appErrorEvents.length, 0);
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 1250);
    });
    return p;
  },
});

test({
  name: "SSEStreamTarget - connection closed readable stream",
  async fn() {
    let closed = false;
    let errored = false;
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    const sse = new SSEStreamTarget(context);
    sse.addEventListener("close", () => {
      closed = true;
    });
    sse.addEventListener("error", () => {
      errored = true;
    });
    assert(context.response.body instanceof ReadableStream);
    context.response.body.cancel(
      new Error("connection closed before message completed"),
    );
    assert(closed);
    assert(!errored);
  },
});

test({
  name: "SSEStreamTarget - inspecting",
  fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request, {});
    assertEquals(
      Deno.inspect(new SSEStreamTarget(context)),
      isNode()
        ? `SSEStreamTarget {\n  '#closed': false,\n  '#context': Context {\n    app: EventTarget,\n    cookies: [Cookies],\n    isUpgradable: false,\n    respond: true,\n    request: [Request],\n    response: [Response],\n    socket: undefined,\n    state: {}\n  }\n}`
        : `SSEStreamTarget {\n  "#closed": false,\n  "#context": Context {\n  app: EventTarget {
    [Symbol()]: {
      assignedSlot: false,
      hasActivationBehavior: false,
      host: null,
      listeners: { error: [Array] },
      mode: ""
    },
    [Symbol("[[webidl.brand]]")]: Symbol("[[webidl.brand]]")
  },\n  cookies: Cookies [],\n  isUpgradable: false,\n  respond: true,\n  request: Request {\n  hasBody: false,\n  headers: Headers {},\n  ip: "",\n  ips: [],\n  method: "GET",\n  secure: false,\n  url: "http://localhost:8000/"\n},\n  response: Response {\n  body: ReadableStream { locked: false },\n  headers: Headers {\n  "cache-control": "no-cache",\n  connection: "Keep-Alive",\n  "content-type": "text/event-stream",\n  "keep-alive": "timeout=9007199254740991"\n},\n  status: 200,\n  type: undefined,\n  writable: true\n},\n  socket: undefined,\n  state: {}\n}\n}`,
    );
  },
});
