// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertStrictEquals, unreachable } from "./test_deps.ts";

import { HttpServerNative, NativeRequest } from "./http_server_native.ts";

import { Application } from "./application.ts";

const { test } = Deno;

function createMockConn() {
  return {
    localAddr: { transport: "tcp", hostname: "localhost", port: 8000 },
    remoteAddr: { transport: "tcp", hostname: "remote", port: 4567 },
    rid: 1,
  } as Deno.Conn;
}

test({
  name: "NativeRequest",
  async fn() {
    const respondWithStack: Array<Response | Promise<Response>> = [];
    const request = new Request("http://localhost:8000/", {
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
    const response = new Response("hello deno");
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
        nativeRequest.respond(new Response(expectedBody));
      }
    })();

    try {
      const response = await fetch(`http://localhost:${listenOptions.port}`);
      assertEquals(await response.text(), expectedBody);
    } catch {
      unreachable();
    } finally {
      server.close();
    }
  },
});
