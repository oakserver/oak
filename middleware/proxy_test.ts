// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { Application } from "../application.ts";
import { Router } from "../router.ts";
import { createMockContext, createMockNext } from "../testing.ts";
import { assert, assertEquals, assertStrictEquals } from "../test_deps.ts";

import { proxy } from "./proxy.ts";

const decoder = new TextDecoder();

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const len = chunks.reduce((len, c) => c.length + len, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return decoder.decode(result);
}

Deno.test({
  name: "proxy - app - type assignment",
  fn() {
    const app = new Application();
    app.use(proxy("https://oakserver.github.io/oak/"));
  },
});

Deno.test({
  name: "proxy - router - type assignment",
  fn() {
    const router = new Router();
    router.get("/", proxy("https://oakserver.github.io/oak/"));
  },
});

Deno.test({
  name: "proxy - no options",
  async fn() {
    function fetch(request: Request): Promise<Response> {
      assertEquals(request.url, "https://oakserver.github.io/oak/FAQ");
      assertEquals(request.headers.get("x-forwarded-for"), "127.0.0.1");

      return Promise.resolve(
        new Response("hello world", {
          headers: {
            "content-type": "plain/text",
          },
          status: 200,
          statusText: "OK",
        }),
      );
    }

    const mw = proxy("https://oakserver.github.io/", { fetch });
    const ctx = createMockContext({
      path: "/oak/FAQ",
    });
    const next = createMockNext();
    await mw(ctx, next);
    assert(ctx.response.body instanceof ReadableStream);
    assertEquals(await readStream(ctx.response.body), "hello world");
    assertStrictEquals(ctx.response.status, 200);
    assertStrictEquals(ctx.response.headers.get("Content-Type"), "plain/text");
  },
});

Deno.test({
  name: "proxy - matches - string",
  async fn() {
    function fetch(_request: Request) {
      return Promise.resolve(new Response("hello world"));
    }

    const mw = proxy("https://oakserver.github.io/", { fetch, match: "/oak" });
    const next = createMockNext();

    const ctx1 = createMockContext({
      path: "/oak/FAQ",
    });
    await mw(ctx1, next);
    assert(ctx1.response.body instanceof ReadableStream);

    const ctx2 = createMockContext({
      path: "/",
    });
    await mw(ctx2, next);
    assertStrictEquals(ctx2.response.body, undefined);
  },
});

Deno.test({
  name: "proxy - matches - regex",
  async fn() {
    function fetch(_request: Request) {
      return Promise.resolve(new Response("hello world"));
    }

    const mw = proxy("https://oakserver.github.io/", { fetch, match: /\.ts$/ });
    const next = createMockNext();

    const ctx1 = createMockContext({
      path: "/oak/index.ts",
    });
    await mw(ctx1, next);
    assert(ctx1.response.body instanceof ReadableStream);

    const ctx2 = createMockContext({
      path: "/oak/index.js",
    });
    await mw(ctx2, next);
    assertStrictEquals(ctx2.response.body, undefined);
  },
});

Deno.test({
  name: "proxy - matches - fn",
  async fn() {
    function fetch(_request: Request) {
      return Promise.resolve(new Response("hello world"));
    }

    const mw = proxy("https://oakserver.github.io/", {
      fetch,
      match(ctx) {
        return ctx.request.url.pathname.startsWith("/oak");
      },
    });
    const next = createMockNext();

    const ctx1 = createMockContext({
      path: "/oak/FAQ",
    });
    await mw(ctx1, next);
    assert(ctx1.response.body instanceof ReadableStream);

    const ctx2 = createMockContext({
      path: "/",
    });
    await mw(ctx2, next);
    assertStrictEquals(ctx2.response.body, undefined);
  },
});

Deno.test({
  name: "proxy - contentType",
  async fn() {
    function fetch(_request: Request) {
      return Promise.resolve(
        new Response(`console.log("hello world");`, {
          headers: { "Content-Type": "text/plain" },
        }),
      );
    }

    const mw = proxy("https://oakserver.github.io/", {
      fetch,
      contentType(url, contentType) {
        assertStrictEquals(url, "");
        assertStrictEquals(contentType, "text/plain");
        return "text/html";
      },
    });

    const next = createMockNext();
    const ctx = createMockContext({
      path: "/oak/index.html",
    });
    await mw(ctx, next);
    assertStrictEquals(ctx.response.headers.get("content-type"), "text/html");
  },
});

Deno.test({
  name: "proxy - preserves - search params",
  async fn() {
    function fetch(request: Request) {
      const url = new URL(request.url);
      assertStrictEquals(url.search, ctx.request.url.search);
      return Promise.resolve(new Response("hello world"));
    }

    const mw = proxy("https://oakserver.github.io/", { fetch });

    const next = createMockNext();
    const ctx = createMockContext({
      path: "/oak/index.html?query=foobar&page=42",
    });
    await mw(ctx, next);
  },
});

Deno.test({
  name: "proxy - forwarded - regex test",
  async fn() {
    function fetch(request: Request): Promise<Response> {
      assertEquals(
        request.headers.get("forwarded"),
        "for=127.0.0.1, for=127.0.0.1",
      );
      return Promise.resolve(new Response("hello world"));
    }

    const mw = proxy("https://oakserver.github.io/", { fetch });
    const ctx = createMockContext({
      path: "/oak/FAQ",
    });
    ctx.request.headers.append("forwarded", "for=127.0.0.1");
    const next = createMockNext();
    await mw(ctx, next);

    const mw2 = proxy("https://oakserver.github.io/", { fetch });
    const ctx2 = createMockContext({
      path: "/oak/FAQ2",
    });
    ctx2.request.headers.append("forwarded", "for=127.0.0.1");
    const next2 = createMockNext();
    await mw2(ctx2, next2);
  },
});
