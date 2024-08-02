// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertStrictEquals, unreachable } from "./deps_test.ts";

import { Server } from "./http_server_native.ts";
import { NativeRequest } from "./http_server_native_request.ts";

import { Application } from "./application.ts";
import { isNode } from "./utils/type_guards.ts";

function createMockNetAddr(): Deno.NetAddr {
  return { transport: "tcp", hostname: "remote", port: 4567 };
}

Deno.test({
  name: "NativeRequest",
  ignore: isNode(),
  async fn() {
    const respondWithStack: Array<Response | Promise<Response>> = [];
    const request = new Request("http://localhost:8000/", {
      method: "POST",
      body: `{"a":"b"}`,
    });
    const remoteAddr = createMockNetAddr();
    const nativeRequest = new NativeRequest(request, { remoteAddr });
    assertEquals(nativeRequest.url, `/`);
    const response = new Response("hello deno");
    nativeRequest.respond(response);
    respondWithStack.push(await nativeRequest.response);
    assertStrictEquals(await respondWithStack[0], response);
  },
});

Deno.test({
  name: "HttpServer closes gracefully after serving requests",
  ignore: isNode(),
  async fn() {
    const abortController = new AbortController();
    const app = new Application();
    const listenOptions = { port: 4505, signal: abortController.signal };

    const server = new Server(app, listenOptions);
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
    } catch (e) {
      console.error(e);
      unreachable();
    } finally {
      abortController.abort();
    }
  },
});

Deno.test({
  name:
    "HttpServer manages errors from mis-use in the application handler gracefully",
  ignore: isNode(),
  async fn() {
    const app = new Application();
    const listenOptions = { port: 4506 };

    const server = new Server(app, listenOptions);
    server.listen();

    (async () => {
      for await (const nativeRequest of server) {
        // deno-lint-ignore no-explicit-any
        nativeRequest.respond(null as any);
      }
    })();

    const res = await fetch(`http://localhost:${listenOptions.port}`);
    assertEquals(res.status, 500);
    await res.text();
    return server.close();
  },
});
