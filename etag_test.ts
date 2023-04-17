// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals } from "./test_deps.ts";
import {
  createMockApp,
  createMockContext,
  mockContextState,
} from "./testing.ts";

import type { Application } from "./application.ts";
import type { Context } from "./context.ts";
import type { RouteParams } from "./router.ts";

import { factory } from "./etag.ts";

const { test } = Deno;

function setup<
  // deno-lint-ignore no-explicit-any
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  path = "/",
  method = "GET",
): {
  app: Application<S>;
  context: Context<S>;
} {
  mockContextState.encodingsAccepted = "identity";
  // deno-lint-ignore no-explicit-any
  const app = createMockApp<any>();
  const context = createMockContext<string, RouteParams<string>, S>({
    app,
    path,
    method,
  });
  return { app, context };
}

const encoder = new TextEncoder();

test({
  name: "etag - middleware - body string",
  async fn() {
    const { context } = setup();
    function next() {
      context.response.body = "hello deno";
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      `"a-YdfmHmj2RiwOVqJupcf3PLK9PuJ"`,
    );
  },
});

test({
  name: "etag - middleware - body Uint8Array",
  async fn() {
    const { context } = setup();
    function next() {
      context.response.body = encoder.encode("hello deno");
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      `"a-YdfmHmj2RiwOVqJupcf3PLK9PuJ"`,
    );
  },
});

test({
  name: "etag - middleware - body File",
  async fn() {
    const { context } = setup();
    let file: Deno.FsFile;
    async function next() {
      file = await Deno.open("./fixtures/test.jpg", {
        read: true,
      });
      context.response.body = file;
    }

    const mw = factory();
    await mw(context, next);
    // Deno.fstat is currently an unstable API in Deno, but the code is written
    // to fail gracefully, so we sniff if the API is unavailable and change
    // the assertions accordingly.
    if ("fstat" in Deno) {
      const actual = context.response.headers.get("etag");
      // mtime will vary from system to system which makes up part of the hash
      // we we only look at the part that is consistent.
      assert(actual && actual.startsWith(`W/"4a3b7-`));
    } else {
      assertEquals(
        context.response.headers.get("etag"),
        null,
      );
    }

    file!.close();
  },
});

test({
  name: "etag - middleware - body JSON-like",
  async fn() {
    const { context } = setup();
    function next() {
      context.response.body = { msg: "hello deno" };
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      `"14-JvQev/2QpYTuhshiKlzH0ZRXxAP"`,
    );
  },
});

test({
  name: "etag - middleware - body function",
  async fn() {
    // if we call the body function in the middleware, we cause problems with
    // the response, so we just have to ignore body functions
    const { context } = setup();
    function next() {
      context.response.body = () => Promise.resolve("hello deno");
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      null,
    );
  },
});

test({
  name: "etag - middleware - body async iterator",
  async fn() {
    // The only async readable we can really support is Deno.FsFile, because we
    // know how to get the meta data in order to build a weak tag.  Other async
    // iterables should be ignored and not serialized as JSON.
    const { context } = setup();
    function next() {
      context.response.body = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("hello deno");
          controller.close();
        },
      });
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      null,
    );
  },
});
