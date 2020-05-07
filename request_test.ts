// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import {
  test,
  assertEquals,
  assertStrictEq,
  assertThrowsAsync,
} from "./test_deps.ts";
import { ServerRequest } from "./deps.ts";
import httpErrors from "./httpError.ts";
import { Request, BodyType } from "./request.ts";

const encoder = new TextEncoder();

function createMockBodyReader(body: string): Deno.Reader {
  const buf = encoder.encode(body);
  let offset = 0;
  return {
    async read(p: Uint8Array): Promise<number | null> {
      if (offset >= buf.length) {
        return null;
      }
      const chunkSize = Math.min(p.length, buf.length - offset);
      p.set(buf);
      offset += chunkSize;
      return chunkSize;
    },
  };
}

interface MockServerRequestOptions {
  url?: string;
  body?: string;
  headerValues?: Record<string, string>;
  proto?: string;
}

function createMockServerRequest(
  { url = "/", body = "", headerValues = {}, proto = "HTTP/1.1" }:
    MockServerRequestOptions = {},
): ServerRequest {
  const headers = new Headers();
  for (const [key, value] of Object.entries(headerValues)) {
    headers.set(key, value);
  }
  if (body.length && !headers.has("content-length")) {
    headers.set("content-length", String(body.length));
  }
  return {
    headers,
    method: "GET",
    url,
    proto,
    body: createMockBodyReader(body),
    async respond() {},
  } as any;
}

test({
  name: "request.searchParams",
  fn() {
    const request = new Request(
      createMockServerRequest({ url: "/foo?bar=baz&qat=qux" }),
    );
    assertEquals(request.path, "/foo");
    assertEquals(request.search, "?bar=baz&qat=qux");
    assertEquals(request.method, "GET");
    assertEquals(Array.from(request.searchParams.entries()), [
      ["bar", "baz"],
      ["qat", "qux"],
    ]);
  },
});

test({
  name: "request.serverRequest",
  fn() {
    const mockServerRequest = createMockServerRequest();
    const request = new Request(mockServerRequest);
    assertStrictEq(request.serverRequest, mockServerRequest);
  },
});

test({
  name: "request.acceptsEncodings",
  fn() {
    const request = new Request(
      createMockServerRequest({
        headerValues: {
          "Accept-Encoding": "gzip, compress;q=0.2, identity;q=0.5",
        },
      }),
    );
    assertEquals(request.acceptsEncodings("gzip", "identity"), "gzip");
  },
});

test({
  name: "request.accepts()",
  fn() {
    const request = new Request(
      createMockServerRequest({
        headerValues: {
          Accept: "application/json;q=0.2, text/html",
        },
      }),
    );
    assertEquals(request.accepts("application/json", "text/html"), "text/html");
  },
});

test({
  name: "request.accepts not provided",
  fn() {
    const request = new Request(
      createMockServerRequest({
        headerValues: {
          Accept: "application/json;q=0.2, text/html",
        },
      }),
    );
    assertEquals(request.accepts(), ["text/html", "application/json"]);
  },
});

test({
  name: "request.accepts none",
  fn() { // requestNoAccepts() {
    const request = new Request(createMockServerRequest({ url: "/" }));
    assertEquals(request.accepts("application/json"), undefined);
  },
});

test({
  name: "request.accepts no match",
  fn() { // requestNoAcceptsMatch() {
    const request = new Request(
      createMockServerRequest({ headerValues: { Accept: "text/html" } }),
    );
    assertEquals(request.accepts("application/json"), undefined);
  },
});

test({
  name: "request.body JSON",
  async fn() { // requestBodyJson() {
    const request = new Request(
      createMockServerRequest({
        body: `{"foo":"bar"}`,
        headerValues: {
          "Content-Type": "application/json",
        },
      }),
    );
    assertEquals(await request.body(), {
      type: BodyType.JSON,
      value: { foo: "bar" },
    });
  },
});

test({
  name: "request.body Form URLEncoded",
  async fn() { // requestBodyForm() {
    const request = new Request(
      createMockServerRequest(
        {
          body: `foo=bar&bar=1&baz=qux+%2B+quux`,
          headerValues: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      ),
    );
    const actual = await request.body();
    assertEquals(actual!.type, BodyType.Form);
    if (actual && actual.type === "form") {
      assertEquals(Array.from(actual.value.entries()), [
        ["foo", "bar"],
        ["bar", "1"],
        ["baz", "qux + quux"],
      ]);
    } else {
      throw Error("Unexpected response");
    }
  },
});

test({
  name: "request.body text",
  async fn() { // requestBodyText() {
    const request = new Request(
      createMockServerRequest({
        body: "hello world!",
        headerValues: {
          "Content-Type": "text/plain",
        },
      }),
    );
    assertEquals(await request.body(), {
      type: BodyType.Text,
      value: "hello world!",
    });
  },
});

test({
  name: "request.body resolves undefined",
  async fn() { // noBodyResolvesUndefined() {
    const request = new Request(createMockServerRequest());
    assertEquals(await request.body(), {
      type: BodyType.Undefined,
      value: undefined,
    });
  },
});

test({
  name: "request.body unsupported media type",
  async fn() { // unsupportedMediaTypeBody() {
    const request = new Request(
      createMockServerRequest({
        body: "blah",
        headerValues: {
          "Content-Type": "multipart/form-data",
        },
      }),
    );
    await assertThrowsAsync(async () => {
      await request.body();
    }, httpErrors.UnsupportedMediaType);
  },
});

test({
  name: "request.protocol http",
  fn() {
    const request = new Request(createMockServerRequest());
    assertEquals(request.protocol, "http");
  },
});

test({
  name: "request.protocol https",
  fn() {
    const request = new Request(
      createMockServerRequest({ proto: "HTTPS/1.1" }),
    );
    assertEquals(request.protocol, "https");
  },
});

test({
  name: "request.secure is false",
  fn() {
    const request = new Request(createMockServerRequest());
    assertEquals(request.secure, false);
  },
});

test({
  name: "request.protocol is true",
  fn() {
    const request = new Request(
      createMockServerRequest({ proto: "HTTPS/1.1" }),
    );
    assertEquals(request.secure, true);
  },
});
