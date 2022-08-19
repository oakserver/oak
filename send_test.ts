// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, assertStrictEquals } from "./test_deps.ts";
import {
  createMockApp,
  createMockContext,
  mockContextState,
} from "./testing.ts";

import type { Application } from "./application.ts";
import type { Context } from "./context.ts";
import { errors } from "./deps.ts";
import * as etag from "./etag.ts";
import type { RouteParams } from "./router.ts";
import { send } from "./send.ts";
import { isNode } from "./util.ts";

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

test({
  name: "send HTML",
  async fn() {
    const { context } = setup("/test.html");
    const fixture = await Deno.readFile("./fixtures/test.html");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    const ab = await nativeResponse.arrayBuffer();
    assertEquals(new Uint8Array(ab), fixture);
    assertEquals(context.response.type, ".html");
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
    context.response.destroy();
  },
});

test({
  name: "send gzip",
  async fn() {
    const { context } = setup("/test.json");
    const fixture = await Deno.readFile("./fixtures/test.json.gz");
    mockContextState.encodingsAccepted = "gzip";
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertEquals(context.response.headers.get("content-encoding"), "gzip");
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send brotli",
  async fn() {
    const { context } = setup("/test.json");
    const fixture = await Deno.readFile("./fixtures/test.json.br");
    mockContextState.encodingsAccepted = "br";
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertEquals(context.response.headers.get("content-encoding"), "br");
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send identity",
  async fn() {
    const { context } = setup("/test.json");
    const fixture = await Deno.readFile("./fixtures/test.json");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send 404",
  async fn() {
    const { context } = setup("/foo.txt");
    mockContextState.encodingsAccepted = "identity";
    let didThrow = false;
    try {
      await send(context, context.request.url.pathname, {
        root: "./fixtures",
      });
    } catch (e) {
      console.log(e);
      assert(e instanceof errors.NotFound);
      didThrow = true;
    }
    assert(didThrow);
  },
});

test({
  name: "send file with spaces",
  async fn() {
    const { context } = setup("/test%20file.json");
    const fixture = await Deno.readFile("./fixtures/test file.json");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send hidden file throws 403",
  async fn() {
    const { context } = setup("/.test.json");
    mockContextState.encodingsAccepted = "identity";
    let didThrow = false;
    try {
      await send(context, context.request.url.pathname, {
        root: "./fixtures",
      });
    } catch (e) {
      assert(e instanceof errors.Forbidden);
      didThrow = true;
    }
    assert(didThrow);
  },
});

test({
  name: "send file from hidden dir throws 403",
  async fn() {
    const { context } = setup("/.test/test.json");
    mockContextState.encodingsAccepted = "identity";
    let didThrow = false;
    try {
      await send(context, context.request.url.pathname, {
        root: "./fixtures",
      });
    } catch (e) {
      assert(e instanceof errors.Forbidden);
      didThrow = true;
    }
    assert(didThrow);
  },
});

test({
  name: "send hidden file succeeds when hidden:true",
  async fn() {
    const { context } = setup("/.test.json");
    const fixture = await Deno.readFile("./fixtures/.test.json");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      hidden: true,
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send file from hidden root succeeds",
  async fn() {
    const { context } = setup("/test.json");
    const fixture = await Deno.readFile("./fixtures/.test/test.json");
    await send(context, context.request.url.pathname, {
      root: "./fixtures/.test",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send url: /../file sends /file",
  async fn() {
    const { context } = setup("/../test.json");
    const fixture = await Deno.readFile("./fixtures/test.json");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send path: /../file throws 403",
  async fn() {
    const { context } = setup("/../test.json");
    mockContextState.encodingsAccepted = "identity";
    let didThrow = false;
    try {
      await send(context, "/../test.json", {
        root: "./fixtures",
      });
    } catch (e) {
      assert(e instanceof errors.Forbidden);
      didThrow = true;
    }
    assert(didThrow);
  },
});

test({
  name: "send allows .. in root",
  async fn() {
    const { context } = setup("/test.json");
    const fixture = await Deno.readFile("./fixtures/test.json");
    await send(context, context.request.url.pathname, {
      root: isNode() ? "../esm/fixtures" : "../oak/fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send If-Modified-Since and it doesn't modified",
  async fn() {
    const { context } = setup("/test.json");
    const fixtureStat = await Deno.stat("./fixtures/test.json");
    context.request.headers.set(
      "If-Modified-Since",
      fixtureStat.mtime!.toUTCString(),
    );
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertStrictEquals(nativeResponse.body, null);
    assertEquals(nativeResponse.status, 304);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      null,
    );
    context.response.destroy();
  },
});

test({
  name: "send If-Modified-Since and it does modified",
  async fn() {
    const { context } = setup("/test.json");
    const fixture = await Deno.readFile("./fixtures/test.json");
    const fixtureStat = await Deno.stat("./fixtures/test.json");
    context.request.headers.set(
      "If-Modified-Since",
      new Date(fixtureStat.mtime!.getTime() - 10000).toUTCString(),
    );
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(nativeResponse.status, 200);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    context.response.destroy();
  },
});

test({
  name: "send sets etag header - less than maxbuffer",
  async fn() {
    const { context } = setup("/test.json");
    const fixture = await Deno.readFile("./fixtures/test.json");
    await send(context, context.request.url.pathname, { root: "./fixtures" });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(nativeResponse.status, 200);
    assertEquals(context.response.type, ".json");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    const etagHeader = context.response.headers.get("etag");
    assertEquals(etagHeader, await etag.calculate(fixture));
  },
});

test({
  name: "send sets etag header - greater than maxbuffer",
  async fn() {
    const { context } = setup("/test.jpg");
    const fixture = await Deno.readFile("./fixtures/test.jpg");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      maxbuffer: 300000,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(nativeResponse.status, 200);
    assertEquals(context.response.type, ".jpg");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    const etagHeader = context.response.headers.get("etag");
    assert(etagHeader && etagHeader.startsWith(`W/"4a3b7-`));
    context.response.destroy();
  },
});

test({
  name: "if-none-match header - not modified",
  async fn() {
    const { context } = setup("/test.jpg");
    const fixture = await Deno.readFile("./fixtures/test.jpg");
    context.request.headers.set("If-None-Match", await etag.calculate(fixture));
    await send(context, context.request.url.pathname, { root: "./fixtures" });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(nativeResponse.status, 304);
    assertEquals(
      context.response.headers.get("etag"),
      await etag.calculate(fixture),
    );
  },
});

test({
  name: "if-none-match header - modified",
  async fn() {
    const { context } = setup("/test.jpg");
    const fixture = await Deno.readFile("./fixtures/test.jpg");
    context.request.headers.set(
      "If-None-Match",
      `"17-dFpfAd6+866Bo994m4Epzil7k2A"`,
    );
    await send(context, context.request.url.pathname, { root: "./fixtures" });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(nativeResponse.status, 200);
    assertEquals(context.response.type, ".jpg");
    assertStrictEquals(context.response.headers.get("content-encoding"), null);
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assertEquals(
      context.response.headers.get("etag"),
      await etag.calculate(fixture),
    );
  },
});

test({
  name: "range header",
  ignore: Deno.build.os === "windows",
  async fn() {
    const { context } = setup("/test.json");
    context.request.headers.set("Range", "bytes=0-5");
    await send(context, context.request.url.pathname, { root: "./fixtures" });
    const response = await context.response.toDomResponse();
    assertEquals(response.status, 206);
    assertEquals(context.response.type, ".json");
    assertEquals(context.response.headers.get("content-length"), "6");
    assertEquals(await response.text(), `{\n  "h`);
  },
});

test({
  name: "range header from 0-",
  ignore: Deno.build.os === "windows",
  async fn() {
    const { context } = setup("/test.json");
    context.request.headers.set("Range", "bytes=0-");
    await send(context, context.request.url.pathname, { root: "./fixtures" });
    const response = await context.response.toDomResponse();
    assertEquals(response.status, 206);
    assertEquals(context.response.type, ".json");
    assertEquals(context.response.headers.get("content-length"), "23");
    assertEquals(await response.text(), `{\n  "hello": "world"\n}\n`);
  },
});

test({
  name: "range header - multiple ranges",
  ignore: Deno.build.os === "windows",
  async fn() {
    const { context } = setup("/test.json");
    context.request.headers.set("Range", "bytes=0-5, 6-9");
    await send(context, context.request.url.pathname, { root: "./fixtures" });
    const response = await context.response.toDomResponse();
    assertEquals(response.status, 206);
    assert(
      response.headers.get("content-type")!.startsWith(
        `multipart/byteranges; boundary=`,
      ),
    );
    assertEquals(response.headers.get("content-length"), "294");
    const actual = await response.text();
    assert(
      actual.includes(
        `\nContent-Type: application/json; charset=UTF-8\nContent-Range: 0-5/23\n\n{\n  "h\n`,
      ),
    );
    assert(
      actual.includes(
        `\nContent-Type: application/json; charset=UTF-8\nContent-Range: 6-9/23\n\nello\n`,
      ),
    );
  },
});

test({
  name: "send - contentTypes - custom",
  async fn() {
    const { context } = setup("/test.importmap");
    const fixture = await Deno.readFile("./fixtures/test.importmap");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      contentTypes: {
        ".importmap": "application/importmap+json",
      },
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, "application/importmap+json");
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
    context.response.destroy();
  },
});

test({
  name: "send - contentTypes - override",
  async fn() {
    const { context } = setup("/test.html");
    const fixture = await Deno.readFile("./fixtures/test.html");
    await send(context, context.request.url.pathname, {
      root: "./fixtures",
      contentTypes: {
        ".html": "plain/text",
      },
      maxbuffer: 0,
    });
    const nativeResponse = await context.response.toDomResponse();
    assertEquals(new Uint8Array(await nativeResponse.arrayBuffer()), fixture);
    assertEquals(context.response.type, "plain/text");
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
    context.response.destroy();
  },
});
