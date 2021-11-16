import * as denoShim from "deno.ns";
// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertStrictEquals, unreachable } from "./test_deps.js";

import { HttpServerNative, NativeRequest } from "./http_server_native.js";

import { Application } from "./application.js";

const { test } = denoShim.Deno;

function createMockConn() {
  return {
    localAddr: { transport: "tcp", hostname: "localhost", port: 8000 },
    remoteAddr: { transport: "tcp", hostname: "remote", port: 4567 },
    rid: 1,
  } as denoShim.Deno.Conn;
}

test({
  name: "NativeRequest",
  async fn() {
    const respondWithStack: Array<denoShim.Response | Promise<denoShim.Response>> = [];
    const request = new denoShim.Request("http://localhost:8000/", {
      method: "POST",
      body: `{"a":"b"}`,
    });
    const conn = createMockConn();
    const nativeRequest = new NativeRequest({
      request,
      respondWith(v) {
        respondWithStack.push(v);
        return Promise.resolve();
      },
    }, { conn });
    assertEquals(nativeRequest.url, `/`);
    assertEquals(respondWithStack.length, 1);
    const response = new denoShim.Response("hello deno");
    nativeRequest.respond(response);
    assertStrictEquals(await respondWithStack[0], response);
  },
});

test({
  name: "HttpServerNative closes gracefully after serving requests",
  async fn() {
    const app = new Application();
    const listenOptions = { port: 4505 };

    const server = new HttpServerNative(app, listenOptions);
    server.listen();

    const expectedBody = "test-body";

    (async () => {
      for await (const nativeRequest of server) {
        nativeRequest.respond(new denoShim.Response(expectedBody));
      }
    })();

    try {
      const response = await denoShim.fetch(`http://localhost:${listenOptions.port}`);
      assertEquals(await response.text(), expectedBody);
    } catch {
      unreachable();
    } finally {
      server.close();
    }
  },
});
