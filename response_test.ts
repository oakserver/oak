// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Status } from "./deps.ts";
import { test, assert, assertEquals } from "./test_deps.ts";
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
  fn() {
    const response = new Response(createMockRequest());
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.body, undefined);
    assertEquals(serverResponse.status, 404);
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
    assertEquals(serverResponse.headers!.get("Content-Length"), "0");
  },
});

test({
  name: "response.status set",
  fn() {
    const response = new Response(createMockRequest());
    response.status = 302;
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.body, undefined);
    assertEquals(serverResponse.status, 302);
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
    assertEquals(serverResponse.headers!.get("Content-Length"), "0");
  },
});

test({
  name: "response.body as text",
  fn() {
    const response = new Response(createMockRequest());
    response.body = "Hello world!";
    const serverResponse = response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as HTML",
  fn() {
    const response = new Response(createMockRequest());
    response.body = "<!DOCTYPE html><html><body>Hello world!</body></html>";
    const serverResponse = response.toServerResponse();
    assertEquals(
      decodeBody(serverResponse.body),
      "<!DOCTYPE html><html><body>Hello world!</body></html>",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "text/html; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as JSON",
  fn() {
    const response = new Response(createMockRequest());
    response.body = { foo: "bar" };
    const serverResponse = response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), `{"foo":"bar"}`);
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "application/json; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as symbol",
  fn() {
    const response = new Response(createMockRequest());
    response.body = Symbol("foo");
    const serverResponse = response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Symbol(foo)");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as Uint8Array",
  fn() {
    const response = new Response(createMockRequest());
    response.body = new TextEncoder().encode("Hello world!");
    const serverResponse = response.toServerResponse();
    assertEquals(decodeBody(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 0);
  },
});

test({
  name: "response.type",
  fn() {
    const response = new Response(createMockRequest());
    response.type = "js";
    response.body = "console.log('hello world');";
    const serverResponse = response.toServerResponse();
    assertEquals(
      decodeBody(serverResponse.body),
      "console.log('hello world');",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "application/javascript; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.type does not overwrite",
  fn() {
    const response = new Response(createMockRequest());
    response.type = "js";
    response.body = "console.log('hello world');";
    response.headers.set("content-type", "text/plain");
    const serverResponse = response.toServerResponse();
    assertEquals(
      decodeBody(serverResponse.body),
      "console.log('hello world');",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(serverResponse.headers!.get("Content-Type"), "text/plain");
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "empty response sets contentLength to 0",
  fn() {
    const response = new Response(createMockRequest());
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.headers!.get("Content-Length"), "0");
  },
});

test({
  name: "response.redirect('./foo')",
  fn() {
    const response = new Response(createMockRequest());
    response.redirect("./foo");
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="./foo">./foo</a>.`,
    );
    assertEquals(serverResponse.headers!.get("Location"), "./foo");
    assertEquals(
      serverResponse.headers?.get("Content-Type"),
      "text/html; charset=utf-8",
    );
  },
});

test({
  name: "response.redirect(URL)",
  fn() {
    const response = new Response(createMockRequest());
    const url = new URL("https://example.com/foo");
    response.redirect(url);
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      serverResponse.headers!.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK)",
  fn() {
    const response = new Response(
      createMockRequest({ headers: [["referrer", "https://example.com/foo"]] }),
    );
    response.redirect(REDIRECT_BACK);
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      serverResponse.headers!.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK) no referrer, but alt",
  fn() {
    const response = new Response(createMockRequest());
    response.redirect(REDIRECT_BACK, new URL("https://example.com/foo"));
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="https://example.com/foo">https://example.com/foo</a>.`,
    );
    assertEquals(
      serverResponse.headers!.get("Location"),
      "https://example.com/foo",
    );
  },
});

test({
  name: "response.redirect(REDIRECT_BACK) no referrer, no alt",
  fn() {
    const response = new Response(createMockRequest());
    response.redirect(REDIRECT_BACK);
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.status, Status.Found);
    assertEquals(
      decodeBody(serverResponse.body),
      `Redirecting to <a href="/">/</a>.`,
    );
    assertEquals(serverResponse.headers!.get("Location"), "/");
  },
});

test({
  name: "response.redirect() no html",
  fn() {
    const response = new Response(createMockRequest({
      accepts(value) {
        return value === "html" ? false : true;
      },
    }));
    response.redirect("https://example.com/foo");
    const serverResponse = response.toServerResponse();
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
  name: "response.body() passes Deno.Reader",
  fn() {
    const response = new Response(createMockRequest());
    const body = new Deno.Buffer();
    response.body = body;
    const serverResponse = response.toServerResponse();
    assert(serverResponse.body === body);
  },
});
