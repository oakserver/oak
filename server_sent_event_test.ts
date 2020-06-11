// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import {
  assert,
  assertEquals,
  BufWriter,
  StringWriter,
  test,
} from "./test_deps.ts";

import { Application } from "./application.ts";
import { ServerRequest } from "./deps.ts";
import { ServerSentEvent, ServerSentEventTarget } from "./server_sent_event.ts";

const preamble = `HTTP/1.1 200 OK
connection: Keep-Alive
content-type: text/event-stream
cache-control: no-cache
keep-alive: timeout=9007199254740991

`;

const env = {
  appTarget: new EventTarget(),
  appErrorEvents: [] as ErrorEvent[],
  outWriter: new StringWriter(),
  connCloseCalled: false,
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
  name: "ServerSentEventTarget - construction",
  async fn() {
    const sse = new ServerSentEventTarget(
      createMockApp(),
      createMockServerRequest(),
    );
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
  name: "ServerSentEventTaget - construction with headers",
  async fn() {
    const expected =
      `HTTP/1.1 200 OK\nconnection: Keep-Alive\ncontent-type: text/event-stream\ncache-control: special\nkeep-alive: timeout=9007199254740991\nx-oak: test\n\n`;
    const sse = new ServerSentEventTarget(
      createMockApp(),
      createMockServerRequest(),
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
  name: "ServerSentEventTarget - dispatchEvent",
  async fn() {
    const sse = new ServerSentEventTarget(
      createMockApp(),
      createMockServerRequest(),
    );
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
  name: "ServerSentEventTarget - dispatchMessage",
  async fn() {
    const sse = new ServerSentEventTarget(
      createMockApp(),
      createMockServerRequest(),
    );
    sse.dispatchMessage("foobar");
    await sse.close();
    assert(env.connCloseCalled);
    const actual = env.outWriter.toString();
    assert(actual.endsWith(`\n\ndata: foobar\n\n`));
    assertEquals(env.appErrorEvents.length, 0);
  },
});

test({
  name: "ServerSentEventTarget - dispatchComment",
  async fn() {
    const sse = new ServerSentEventTarget(
      createMockApp(),
      createMockServerRequest(),
    );
    sse.dispatchComment("foobar");
    await sse.close();
    assert(env.connCloseCalled);
    const actual = env.outWriter.toString();
    assert(actual.endsWith(`\n\n: foobar\n\n`));
    assertEquals(env.appErrorEvents.length, 0);
  },
});
