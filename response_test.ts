// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { Status } from "./deps.ts";
import { assert, assertEquals, assertThrows } from "./test_deps.ts";
import type { Request } from "./request.ts";
import { REDIRECT_BACK, Response } from "./response.ts";
import { isNode } from "./util.ts";

const { test } = Deno;

function createMockRequest({
  headers,
  accepts = (_contentType: string) => {
    return true;
  },
}: {
  headers?: [string, string][];
  accepts?: (contentType: string) => boolean;
} = {}): Request {
  // deno-lint-ignore no-explicit-any
  return { accepts, headers: new Headers(headers) } as any;
}

test({
  name: "response empty",
  async fn() {
    const response = new Response(createMockRequest());
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.body, null);
    assertEquals(nativeResponse.status, 404);
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
    assertEquals(nativeResponse.headers.get("Content-Length"), "0");
  },
});

test({
  name: "response.status set",
  async fn() {
    const response = new Response(createMockRequest());
    response.status = 302;
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.body, null);
    assertEquals(nativeResponse.status, 302);
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
    assertEquals(nativeResponse.headers.get("Content-Length"), "0");
  },
});

test({
  name: "response.body as text",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = "Hello world!";
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), "Hello world!");
    assertEquals(nativeResponse.status, 200);
    assertEquals(
      nativeResponse.headers.get("content-type"),
      "text/plain; charset=UTF-8",
    );
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as HTML",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = "<!DOCTYPE html><html><body>Hello world!</body></html>";
    const nativeResponse = await response.toDomResponse();
    assertEquals(
      await nativeResponse.text(),
      "<!DOCTYPE html><html><body>Hello world!</body></html>",
    );
    assertEquals(nativeResponse.status, 200);
    assertEquals(
      nativeResponse.headers.get("content-type"),
      "text/html; charset=UTF-8",
    );
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as JSON",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = { foo: "bar" };
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), `{"foo":"bar"}`);
    assertEquals(nativeResponse.status, 200);
    assertEquals(
      nativeResponse.headers.get("content-type"),
      "application/json; charset=UTF-8",
    );
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as symbol",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = Symbol("foo");
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), "Symbol(foo)");
    assertEquals(nativeResponse.status, 200);
    assertEquals(
      nativeResponse.headers.get("content-type"),
      "text/plain; charset=UTF-8",
    );
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as Uint8Array",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = new TextEncoder().encode("Hello world!");
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), "Hello world!");
    assertEquals(nativeResponse.status, 200);
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 0);
  },
});

test({
  name: "response.body as function",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = () => "Hello world!";
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), "Hello world!");
    assertEquals(nativeResponse.status, 200);
    assertEquals(
      nativeResponse.headers.get("content-type"),
      "text/plain; charset=UTF-8",
    );
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as readable stream",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("hello ");
        controller.enqueue("deno");
        controller.close();
      },
    });
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), "hello deno");
    assertEquals(nativeResponse.status, 200);
  },
});

test({
  name: "response.body as async iterable",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = {
      async *[Symbol.asyncIterator]() {
        yield "hello ";
        yield "deno";
        return;
      },
    };
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), "hello deno");
    assertEquals(nativeResponse.status, 200);
  },
});

test({
  name: "response.body as async function",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = () => Promise.resolve("Hello world!");
    const nativeResponse = await response.toDomResponse();
    assertEquals(await nativeResponse.text(), "Hello world!");
    assertEquals(nativeResponse.status, 200);
    assertEquals(
      nativeResponse.headers.get("content-type"),
      "text/plain; charset=UTF-8",
    );
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.type",
  async fn() {
    const response = new Response(createMockRequest());
    response.type = "js";
    response.body = "console.log('hello world');";
    const nativeResponse = await response.toDomResponse();
    assertEquals(
      await nativeResponse.text(),
      "console.log('hello world');",
    );
    assertEquals(nativeResponse.status, 200);
    assertEquals(
      nativeResponse.headers.get("content-type"),
      "application/javascript; charset=UTF-8",
    );
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.type does not overwrite",
  async fn() {
    const response = new Response(createMockRequest());
    response.type = "js";
    response.body = "console.log('hello world');";
    response.headers.set("content-type", "text/plain");
    const nativeResponse = await response.toDomResponse();
    assertEquals(
      await nativeResponse.text(),
      "console.log('hello world');",
    );
    assertEquals(nativeResponse.status, 200);
    assertEquals(nativeResponse.headers.get("Content-Type"), "text/plain");
    assertEquals(Array.from(nativeResponse.headers.entries()).length, 1);
  },
});

test({
  name: "empty response sets contentLength to 0",
  async fn() {
    const response = new Response(createMockRequest());
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.headers.get("Content-Length"), "0");
  },
});

test({
  name: "response.redirect('./foo')",
  async fn() {
    const response = new Response(createMockRequest());
    response.redirect("./foo");
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.Found);
    assertEquals(
      await nativeResponse.text(),
      `Redirecting to <a href="./foo">./foo</a>.`,
    );
    assertEquals(nativeResponse.headers.get("Location"), "./foo");
    assertEquals(
      nativeResponse.headers.get("Content-Type"),
      "text/html; charset=UTF-8",
    );
  },
});

test({
  name: "response.redirect(URL)",
  async fn() {
    const response = new Response(createMockRequest());
    const url = new URL("https://example.com/foo");
    response.redirect(url);
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.Found);
    assertEquals(
      await nativeResponse.text(),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      nativeResponse.headers.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK)",
  async fn() {
    const response = new Response(
      createMockRequest({ headers: [["referer", "https://example.com/foo"]] }),
    );
    response.redirect(REDIRECT_BACK);
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.Found);
    assertEquals(
      await nativeResponse.text(),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      nativeResponse.headers.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK) no referrer, but alt",
  async fn() {
    const response = new Response(createMockRequest());
    response.redirect(REDIRECT_BACK, new URL("https://example.com/foo"));
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.Found);
    assertEquals(
      await nativeResponse.text(),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      nativeResponse.headers.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK) no referrer, no alt",
  async fn() {
    const response = new Response(createMockRequest());
    response.redirect(REDIRECT_BACK);
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.Found);
    assertEquals(
      await nativeResponse.text(),
      `Redirecting to <a href="/">/</a>.`,
    );
    assertEquals(nativeResponse.headers.get("Location"), "/");
  },
});

test({
  name: "response.redirect() no html",
  async fn() {
    const response = new Response(createMockRequest({
      accepts(value) {
        return value === "html" ? false : true;
      },
    }));
    response.redirect("https://example.com/foo");
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.Found);
    assertEquals(
      await nativeResponse.text(),
      `Redirecting to https://example.com/foo.`,
    );
    assertEquals(
      nativeResponse.headers.get("Location"),
      "https://example.com/foo",
    );
    assertEquals(
      nativeResponse.headers.get("Content-Type"),
      "text/plain; charset=UTF-8",
    );
  },
});

test({
  name: "response.redirect() with url on query string",
  async fn() {
    const response = new Response(createMockRequest());
    response.redirect(
      "https://example.com/foo?redirect=https%3A%2F%2Fdeno.land",
    );
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.Found);
    assertEquals(
      nativeResponse.headers.get("Location"),
      "https://example.com/foo?redirect=https%3A%2F%2Fdeno.land",
    );
  },
});

test({
  name: "response.status reflects body state",
  fn() {
    const response = new Response(createMockRequest());
    assertEquals(response.status, Status.NotFound);
    response.body = "hello";
    assertEquals(response.status, Status.OK);
    response.body = null;
    assertEquals(response.status, Status.NoContent);
    response.status = Status.PartialContent;
    assertEquals(response.status, Status.PartialContent);
  },
});

test({
  name: "response.toDomResponse() is a memo",
  async fn() {
    const response = new Response(createMockRequest());
    const sr1 = await response.toDomResponse();
    const sr2 = await response.toDomResponse();
    assert(sr1 === sr2);
  },
});

test({
  name: "response.body cannot be set after server response",
  async fn() {
    const response = new Response(createMockRequest());
    await response.toDomResponse();
    assertThrows(() => {
      response.body = "";
    }, Error);
  },
});

test({
  name: "response.status cannot be set after server response",
  async fn() {
    const response = new Response(createMockRequest());
    await response.toDomResponse();
    assertThrows(() => {
      response.status = Status.Found;
    }, Error);
  },
});

test({
  name: "response.body handles null",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = null;
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.NoContent);
  },
});

test({
  name: "response.body handles falsy values",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = 0;
    const nativeResponse = await response.toDomResponse();
    assertEquals(nativeResponse.status, Status.OK);
  },
});

test({
  name: "Response - inspecting",
  fn() {
    assertEquals(
      Deno.inspect(new Response(createMockRequest())),
      isNode()
        ? `Response {\n  body: undefined,\n  headers: HeadersList {\n    [Symbol(headers map)]: Map(0) {},\n    [Symbol(headers map sorted)]: null\n  },\n  status: 404,\n  type: undefined,\n  writable: true\n}`
        : `Response { body: undefined, headers: Headers {}, status: 404, type: undefined, writable: true }`,
    );
  },
});
