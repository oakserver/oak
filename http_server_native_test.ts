// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertStrictEquals, test } from "./test_deps.ts";

import { hasNativeHttp, NativeRequest } from "./http_server_native.ts";

function createMockConn() {
  return {
    localAddr: { transport: "tcp", hostname: "localhost", port: 8000 },
    remoteAddr: { transport: "tcp", hostname: "remote", port: 4567 },
    rid: 1,
  } as Deno.Conn;
}

test({
  name: "hasNativeHttp()",
  fn() {
    assertEquals(hasNativeHttp(), "serveHttp" in Deno);
  },
});

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
    }, conn);
    assertEquals(nativeRequest.url, `/`);
    assertEquals(respondWithStack.length, 1);
    const response = new Response("hello deno");
    nativeRequest.respond(response);
    assertStrictEquals(await respondWithStack[0], response);
  },
});
