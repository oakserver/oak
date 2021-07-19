// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

import { assert, assertEquals } from "./test_deps.ts";
import type { WebSocketEvent } from "./test_deps.ts";
import { WebSocketShim } from "./websocket.ts";
import type { WebSocketStd } from "./deps.ts";

let closeCallStack: ({ code: number; reason?: any })[] = [];
let sendCallStack: (string | ArrayBufferLike | Blob | ArrayBufferView)[] = [];

interface MockWebSocketOptions {
  events?: WebSocketEvent[];
  rejectClose?: boolean;
  rejectSend?: boolean;
}

function createMockWebSocket(
  { events = [], rejectClose = false, rejectSend = false }:
    MockWebSocketOptions = {},
): WebSocketStd {
  closeCallStack = [];
  sendCallStack = [];
  return {
    async *[Symbol.asyncIterator](): AsyncIterableIterator<WebSocketEvent> {
      for (const event of events) {
        yield event;
      }
    },
    close(code: number, reason?: any) {
      closeCallStack.push({ code, reason });
      if (rejectClose) {
        return Promise.reject(new Error("rejected close"));
      } else {
        return Promise.resolve();
      }
    },
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      sendCallStack.push(data);
      if (rejectSend) {
        return Promise.reject(new Error("reject send"));
      } else {
        return Promise.resolve();
      }
    },
  } as any;
}

Deno.test({
  name: "websocket - WebSocketShim - basic",
  async fn() {
    let resolve: (value: void | PromiseLike<void>) => void;
    const p = new Promise<void>((res) => {
      resolve = res;
    });
    const ws: WebSocket = new WebSocketShim(
      createMockWebSocket({
        events: ["hello", "world", {
          code: 1000,
          reason: "goodbye",
        }],
      }),
      "https://localhost/",
    );
    const actual: [string, any][] = [];
    ws.addEventListener("open", (_evt) => {
      actual.push(["open", undefined]);
    });
    ws.addEventListener("close", (evt) => {
      const { code, reason } = evt;
      actual.push(["close", { code, reason }]);
      resolve();
    });
    ws.addEventListener("error", (evt) => {
      actual.push(["error", (evt as ErrorEvent).error]);
    });
    ws.addEventListener("message", (evt) => {
      actual.push(["message", evt.data]);
    });
    await p;
    assertEquals(actual, [
      ["open", undefined],
      ["message", "hello"],
      ["message", "world"],
      ["close", { code: 1000, reason: "goodbye" }],
    ]);
  },
});

Deno.test({
  name: "websocket - WebSocketShim - binary data",
  async fn() {
    let resolve: (value: void | PromiseLike<void>) => void;
    const p = new Promise<void>((res) => {
      resolve = res;
    });
    const ws: WebSocket = new WebSocketShim(
      createMockWebSocket({
        events: [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8]), {
          code: 1000,
          reason: "goodbye",
        }],
      }),
      "https://localhost/",
    );
    const actual: [string, any][] = [];
    ws.addEventListener("open", (_evt) => {
      actual.push(["open", undefined]);
    });
    ws.addEventListener("close", (evt) => {
      const { code, reason } = evt;
      actual.push(["close", { code, reason }]);
      resolve();
    });
    ws.addEventListener("error", (evt) => {
      actual.push(["error", (evt as ErrorEvent).error]);
    });
    ws.addEventListener("message", (evt) => {
      ws.binaryType = "arraybuffer";
      actual.push(["message", evt.data]);
    });
    await p;
    assertEquals(actual.length, 4);
    assertEquals(actual[0], ["open", undefined]);
    assertEquals(actual[1][0], "message");
    assertEquals(actual[2][0], "message");
    assert(actual[1][1] instanceof Blob);
    assertEquals(
      new Uint8Array(await actual[1][1].arrayBuffer()),
      new Uint8Array([1, 2, 3, 4]),
    );
    assert(actual[2][1] instanceof ArrayBuffer);
    assertEquals(new Uint8Array(actual[2][1]), new Uint8Array([5, 6, 7, 8]));
    assertEquals(actual[3], ["close", { code: 1000, reason: "goodbye" }]);
  },
});

Deno.test({
  name: "websocket - WebSocketShim - send",
  async fn() {
    let resolve: (value: void | PromiseLike<void>) => void;
    let reject: (reason?: any) => void;
    const p = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const ws: WebSocket = new WebSocketShim(
      createMockWebSocket({ events: [{ code: 1000, reason: "goodbye" }] }),
      "https://localhost/",
    );
    ws.addEventListener("close", () => {
      resolve();
    });
    ws.addEventListener("error", (evt) => {
      reject((evt as ErrorEvent).error);
    });
    ws.send("hello world");
    await p;
    assertEquals(sendCallStack, ["hello world"]);
  },
});

Deno.test({
  name: "websocket - WebSocketShim - send errors",
  async fn() {
    let resolve: (value: Error | PromiseLike<Error>) => void;
    const p = new Promise<Error>((res) => {
      resolve = res;
    });
    const ws: WebSocket = new WebSocketShim(
      createMockWebSocket({
        events: [{ code: 1000, reason: "goodbye" }],
        rejectSend: true,
      }),
      "https://localhost/",
    );
    ws.addEventListener("error", (evt) => {
      assert(evt instanceof ErrorEvent);
      resolve(evt.error);
    });
    ws.send("hello world");
    const error = await p;
    assertEquals(error.message, "reject send");
  },
});

Deno.test({
  name: "websocket - WebSocketShim - close",
  async fn() {
    let resolve: (value: void | PromiseLike<void>) => void;
    let reject: (reason?: any) => void;
    const p = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const ws: WebSocket = new WebSocketShim(
      createMockWebSocket({ events: [{ code: 1000, reason: "goodbye" }] }),
      "https://localhost/",
    );
    ws.addEventListener("close", () => {
      resolve();
    });
    ws.addEventListener("error", (evt) => {
      reject((evt as ErrorEvent).error);
    });
    ws.close(1001, "bye");
    await p;
    assertEquals(closeCallStack, [{ code: 1001, reason: "bye" }]);
  },
});

Deno.test({
  name: "websocket - WebSocketShim - close errors",
  async fn() {
    let resolve: (value: Error | PromiseLike<Error>) => void;
    const p = new Promise<Error>((res) => {
      resolve = res;
    });
    const ws: WebSocket = new WebSocketShim(
      createMockWebSocket({
        events: [{ code: 1000, reason: "goodbye" }],
        rejectClose: true,
      }),
      "https://localhost/",
    );
    ws.addEventListener("error", (evt) => {
      assert(evt instanceof ErrorEvent);
      resolve(evt.error);
    });
    ws.close(1001, "bye");
    const error = await p;
    assertEquals(error.message, "rejected close");
  },
});
