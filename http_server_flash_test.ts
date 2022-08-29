// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { deferred } from "./deps.ts";
import { FlashServer, hasFlash } from "./http_server_flash.ts";
import { HttpRequest } from "./http_request.ts";

import { Application } from "./application.ts";
import { assertEquals, assertStrictEquals, unreachable } from "./test_deps.ts";
import { assertInstanceOf } from "https://deno.land/std@0.152.0/testing/asserts.ts";

Deno.test({
  name: "HttpRequest",
  async fn() {
    const respond = deferred<Response>();
    const request = new Request("http://localhost:8000/", {
      method: "POST",
      body: `{"a":"b"}`,
    });
    const httpRequest = new HttpRequest(request, respond);
    assertEquals(httpRequest.url, "/");
    const response = new Response("hello deno");
    httpRequest.respond(response);
    assertStrictEquals(await respond, response);
  },
});

Deno.test({
  name: "FlashServer closes gracefully after serving requests",
  ignore: !hasFlash(),
  async fn() {
    const app = new Application();
    const listenOptions = { port: 4507 };

    const server = new FlashServer(app, listenOptions);
    server.listen();

    const expectedBody = "test-body";
    const d = deferred();

    (async () => {
      for await (const nativeRequest of server) {
        nativeRequest.respond(new Response(expectedBody));
      }
      d.resolve();
    })();

    try {
      const response = await fetch(`http://localhost:${listenOptions.port}`);
      assertEquals(await response.text(), expectedBody);
    } catch {
      unreachable();
    } finally {
      await server.close();
      await d;
    }
  },
});

Deno.test({
  name:
    "FlashServer manages errors from mis-use in the application handler gracefully",
  // Currently we can't get this to work with flash.
  ignore: true,
  async fn() {
    const app = new Application();
    const listenOptions = { port: 4508 };

    const server = new FlashServer(app, listenOptions);
    server.listen();

    const d = deferred();

    (async () => {
      for await (const nativeRequest of server) {
        // deno-lint-ignore no-explicit-any
        nativeRequest.respond(null as any);
      }
      d.resolve();
    })();

    try {
      await fetch(`http://localhost:${listenOptions.port}`);
      unreachable();
    } catch (e) {
      assertInstanceOf(e, TypeError);
    } finally {
      await server.close();
      await d;
    }
  },
});
