// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import {
  assert,
  assertEquals,
  BufWriter,
  StringWriter,
  test,
} from "./test_deps.ts";

import type { Application } from "./application.ts";
import { Context } from "./context.ts";
import { NativeRequest } from "./http_server_native.ts";
import type { ServerRequest } from "./http_server_std.ts";
import {
  ServerSentEvent,
  SSEStdLibTarget,
  SSEStreamTarget,
} from "./server_sent_event.ts";

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

function createMockServerRequest(): ServerRequest {
  env.outWriter = new StringWriter();
  env.connCloseCalled = false;
  return {
    conn: {
      close() {
        env.connCloseCalled = true;
      },
    },
    w: new BufWriter(env.outWriter),
  } as any;
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
  name: "SSEStdLibTarget - construction",
  async fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
    const sse = new SSEStdLibTarget(context);
    assertEquals(sse.closed, false);
    await sse.close();
    assert(env.connCloseCalled);
    assertEquals(sse.closed, true);
    const actual = String(env.outWriter);
    assertEquals(actual, preamble);
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStdLibTarget - construction with headers",
  async fn() {
    const expected =
      `HTTP/1.1 200 OK\ncache-control: special\nconnection: Keep-Alive\ncontent-type: text/event-stream\nkeep-alive: timeout=9007199254740991\nx-oak: test\n\n`;
    const context = new Context(createMockApp(), createMockServerRequest());
    const sse = new SSEStdLibTarget(
      context,
      {
        headers: new Headers([["X-Oak", "test"], ["Cache-Control", "special"]]),
      },
    );
    await sse.close();
    const actual = String(env.outWriter);
    assertEquals(actual, expected);
  },
});

test({
  name: "SSEStdLibTarget - dispatchEvent",
  async fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
    const sse = new SSEStdLibTarget(context);
    const evt = new ServerSentEvent("message", "foobar");
    sse.dispatchEvent(evt);
    await sse.close();
    assert(env.connCloseCalled);
    const actual = env.outWriter.toString();
    assert(actual.endsWith(`\n\nevent: message\ndata: foobar\n\n`));
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStdLibTarget - dispatchMessage",
  async fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
    const sse = new SSEStdLibTarget(context);
    sse.dispatchMessage("foobar");
    await sse.close();
    assert(env.connCloseCalled);
    const actual = env.outWriter.toString();
    assert(actual.endsWith(`\n\ndata: foobar\n\n`));
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStdLibTarget - dispatchComment",
  async fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
    const sse = new SSEStdLibTarget(context);
    sse.dispatchComment("foobar");
    await sse.close();
    assert(env.connCloseCalled);
    const actual = env.outWriter.toString();
    assert(actual.endsWith(`\n\n: foobar\n\n`));
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStdLibTarget - synchronous dispatch",
  async fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
    const sse = new SSEStdLibTarget(context);
    sse.dispatchComment("1");
    sse.dispatchComment("2");
    sse.dispatchComment("3");
    sse.dispatchComment("4");
    await sse.close();
    assert(env.connCloseCalled);
    const actual = env.outWriter.toString();
    assert(actual.endsWith(`\n\n: 1\n\n: 2\n\n: 3\n\n: 4\n\n`));
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStreamTarget - construction",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request);
    const sse = new SSEStreamTarget(context);
    assertEquals(sse.closed, false);
    await request.respond(await context.response.toDomResponse());
    await sse.close();
    assert(env.response);
    assert(env.response.body);
    const reader = env.response.body.getReader();
    await reader.closed;
    assertEquals(env.response.status, 200);
    console.log(context.response.headers);
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
    const context = new Context(createMockApp(), request);
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
    const context = new Context(createMockApp(), request);
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
    const context = new Context(createMockApp(), request);
    const sse = new SSEStreamTarget(context);
    await request.respond(await context.response.toDomResponse());
    sse.dispatchMessage("foobar");
    await sse.close();
    assert(env.connCloseCalled);
    assert(env.response);
    assertEquals(await env.response.text(), "data: foobar\n\n");
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "SSEStreamTarget - dispatchComment",
  async fn() {
    const request = createMockNativeRequest();
    const context = new Context(createMockApp(), request);
    const sse = new SSEStreamTarget(context);
    await request.respond(await context.response.toDomResponse());
    sse.dispatchComment("foobar");
    await sse.close();
    assert(env.connCloseCalled);
    assert(env.response);
    assertEquals(await env.response.text(), ": foobar\n\n");
    assertEquals(env.appErrorEvents.length, 0);
  },
});
