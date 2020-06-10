// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Status } from "./deps.ts";
import { test, assert, assertEquals, assertThrows } from "./test_deps.ts";
import { Request } from "./request.ts";
import { Response, REDIRECT_BACK } from "./response.ts";

const decoder = new TextDecoder();

function decodeBody(body: Uint8Array | Deno.Reader | undefined): string {
  return decoder.decode(body as Uint8Array);
}

function createMockRequest({
  headers,
  accepts = (_contentType: string) => {
    return true;
  },
}: {
  headers?: [string, string][];
  accepts?: (contentType: string) => boolean;
} = {}): Request {
  return { accepts, headers: new Headers(headers) } as any;
}

test({
  name: "response empty",
  async fn() {
    const response = new Response(createMockRequest());
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.body, undefined);
    assertEquals(serverResponse.status, 404);
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
    assertEquals(serverResponse.headers.get("Content-Length"), "0");
  },
});

test({
  name: "response.status set",
  async fn() {
    const response = new Response(createMockRequest());
    response.status = 302;
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.body, undefined);
    assertEquals(serverResponse.status, 302);
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
    assertEquals(serverResponse.headers.get("Content-Length"), "0");
  },
});

test({
  name: "response.body as text",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = "Hello world!";
    const serverResponse = await response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as HTML",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = "<!DOCTYPE html><html><body>Hello world!</body></html>";
    const serverResponse = await response.toServerResponse();
    assertEquals(
      decodeBody(serverResponse.body),
      "<!DOCTYPE html><html><body>Hello world!</body></html>",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as JSON",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = { foo: "bar" };
    const serverResponse = await response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), `{"foo":"bar"}`);
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as symbol",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = Symbol("foo");
    const serverResponse = await response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Symbol(foo)");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as Uint8Array",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = new TextEncoder().encode("Hello world!");
    const serverResponse = await response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(Array.from(serverResponse.headers.entries()).length, 0);
  },
});

test({
  name: "response.body as function",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = () => "Hello world!";
    const serverResponse = await response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.body as async function",
  async fn() {
    const response = new Response(createMockRequest());
    response.body = async () => "Hello world!";
    const serverResponse = await response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.type",
  async fn() {
    const response = new Response(createMockRequest());
    response.type = "js";
    response.body = "console.log('hello world');";
    const serverResponse = await response.toServerResponse();
    assertEquals(
      decodeBody(serverResponse.body),
      "console.log('hello world');",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers.get("content-type"),
      "application/javascript; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "response.type does not overwrite",
  async fn() {
    const response = new Response(createMockRequest());
    response.type = "js";
    response.body = "console.log('hello world');";
    response.headers.set("content-type", "text/plain");
    const serverResponse = await response.toServerResponse();
    assertEquals(
      decodeBody(serverResponse.body),
      "console.log('hello world');",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(serverResponse.headers.get("Content-Type"), "text/plain");
    assertEquals(Array.from(serverResponse.headers.entries()).length, 1);
  },
});

test({
  name: "empty response sets contentLength to 0",
  async fn() {
    const response = new Response(createMockRequest());
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.headers.get("Content-Length"), "0");
  },
});

test({
  name: "response.redirect('./foo')",
  async fn() {
    const response = new Response(createMockRequest());
    response.redirect("./foo");
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="./foo">./foo</a>.`,
    );
    assertEquals(serverResponse.headers.get("Location"), "./foo");
    assertEquals(
      serverResponse.headers?.get("Content-Type"),
      "text/html; charset=utf-8",
    );
  },
});

test({
  name: "response.redirect(URL)",
  async fn() {
    const response = new Response(createMockRequest());
    const url = new URL("https://example.com/foo");
    response.redirect(url);
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      serverResponse.headers.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK)",
  async fn() {
    const response = new Response(
      createMockRequest({ headers: [["referrer", "https://example.com/foo"]] }),
    );
    response.redirect(REDIRECT_BACK);
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      serverResponse.headers.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK) no referrer, but alt",
  async fn() {
    const response = new Response(createMockRequest());
    response.redirect(REDIRECT_BACK, new URL("https://example.com/foo"));
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      serverResponse.headers.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK) no referrer, no alt",
  async fn() {
    const response = new Response(createMockRequest());
    response.redirect(REDIRECT_BACK);
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="/">/</a>.`,
    );
    assertEquals(serverResponse.headers.get("Location"), "/");
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
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to https://example.com/foo.`,
    );
    assertEquals(
      serverResponse.headers?.get("Location"),
      "https://example.com/foo",
    );
    assertEquals(
      serverResponse.headers?.get("Content-Type"),
      "text/plain; charset=utf-8",
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
    const serverResponse = await response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      serverResponse.headers?.get("Location"),
      "https://example.com/foo?redirect=https%3A%2F%2Fdeno.land",
    );
  },
});

test({
  name: "response.body() passes Deno.Reader",
  async fn() {
    const response = new Response(createMockRequest());
    const body = new Deno.Buffer();
    response.body = body;
    const serverResponse = await response.toServerResponse();
    assert(serverResponse.body === body);
  },
});

test({
  name: "response.status reflects body state",
  fn() {
    const response = new Response(createMockRequest());
    assertEquals(response.status, Status.NotFound);
    response.body = "hello";
    assertEquals(response.status, Status.OK);
    response.status = Status.PartialContent;
    assertEquals(response.status, Status.PartialContent);
  },
});

test({
  name: "response.toServerResponse() is a memo",
  async fn() {
    const response = new Response(createMockRequest());
    const sr1 = await response.toServerResponse();
    const sr2 = await response.toServerResponse();
    assert(sr1 === sr2);
  },
});

test({
  name: "response.body cannot be set after server response",
  async fn() {
    const response = new Response(createMockRequest());
    await response.toServerResponse();
    assertThrows(() => {
      response.body = "";
    }, Error);
  },
});

test({
  name: "response.status cannot be set after server response",
  async fn() {
    const response = new Response(createMockRequest());
    await response.toServerResponse();
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
    await response.toServerResponse();
  },
});
