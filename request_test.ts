// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "./test_deps.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import type { NativeRequestOptions } from "./http_server_native_request.ts";
import { Request } from "./request.ts";
import { isNode } from "./util.ts";

const { test } = Deno;

function createMockNativeRequest(
  url = "http://localhost/index.html",
  requestInit: RequestInit = {},
  options?: NativeRequestOptions,
) {
  const request: globalThis.Request = new (globalThis as any).Request(
    url,
    requestInit,
  );

  return new NativeRequest({
    request,
    async respondWith(r) {
      await r;
    },
  }, options);
}

test({
  name: "request.searchParams",
  fn() {
    const request = new Request(
      createMockNativeRequest("http://localhost/foo?bar=baz&qat=qux"),
      {},
    );
    assertEquals(request.url.pathname, "/foo");
    assertEquals(request.url.search, "?bar=baz&qat=qux");
    assertEquals(request.method, "GET");
    assertEquals(Array.from(request.url.searchParams.entries()), [
      ["bar", "baz"],
      ["qat", "qux"],
    ]);
  },
});

test({
  name: "request.url",
  fn() {
    const mockServerRequest = createMockNativeRequest(
      "https://oakserver.github.io:8080/foo/bar/baz?up=down",
    );
    const request = new Request(mockServerRequest, {
      proxy: false,
      secure: true,
    });
    assert(request.url instanceof URL);
    assertEquals(request.url.protocol, "https:");
    assertEquals(request.url.hostname, "oakserver.github.io");
    assertEquals(request.url.host, "oakserver.github.io:8080");
    assertEquals(request.url.pathname, "/foo/bar/baz");
  },
});

test({
  name: "request.serverRequest",
  fn() {
    const mockServerRequest = createMockNativeRequest();
    const request = new Request(mockServerRequest);
    assertStrictEquals(request.originalRequest, mockServerRequest);
  },
});

test({
  name: "request.acceptsEncodings",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html", {
        headers: {
          "Accept-Encoding": "gzip, compress;q=0.2, identity;q=0.5",
        },
      }),
    );
    assertEquals(request.acceptsEncodings("gzip", "identity"), "gzip");
  },
});

test({
  name: "request.acceptsEncodings - no header",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html"),
    );
    assertEquals(request.acceptsEncodings("gzip", "identity"), "gzip");
  },
});

test({
  name: "request.acceptsEncodings - no header no encodings",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html"),
    );
    assertEquals(request.acceptsEncodings(), ["*"]);
  },
});

test({
  name: "request.accepts()",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html", {
        headers: {
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
      createMockNativeRequest("https://localhost/index.html", {
        headers: {
          Accept: "application/json;q=0.2, text/html",
        },
      }),
    );
    assertEquals(request.accepts(), ["text/html", "application/json"]);
  },
});

test({
  name: "request.accepts no header",
  fn() {
    const request = new Request(createMockNativeRequest("https://localhost/"));
    assertEquals(request.accepts("application/json"), "application/json");
  },
});

test({
  name: "request.accepts no header, no args",
  fn() {
    const request = new Request(createMockNativeRequest("https://localhost/"));
    assertEquals(request.accepts(), ["*/*"]);
  },
});

test({
  name: "request.accepts no match",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html", {
        headers: { Accept: "text/html" },
      }),
    );
    assertEquals(request.accepts("application/json"), undefined);
  },
});

test({
  name: "request.body()",
  async fn() {
    const body = JSON.stringify({ hello: "world" });
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html", {
        body,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(body.length),
        },
      }),
    );
    assert(request.hasBody);
    const actual = request.body();
    assertEquals(actual.type, "json");
    assertEquals(await actual.value, { hello: "world" });
  },
});

test({
  name: "request.body() passes args",
  async fn() {
    const body = JSON.stringify({ hello: "world" });
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html", {
        body,
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "content-length": String(body.length),
        },
      }),
    );
    const actual = request.body({ type: "json" });
    assertEquals(actual.type, "json");
    assertEquals(await actual.value, { hello: "world" });
  },
});

test({
  name: "request.secure is false",
  fn() {
    const request = new Request(createMockNativeRequest());
    assertEquals(request.secure, false);
  },
});

test({
  name: "request.secure is true",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html"),
      { proxy: false, secure: true },
    );
    assertEquals(request.secure, true);
  },
});

test({
  name: "request with proxy true",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://example.com/index.html", {
        headers: {
          "x-forwarded-host": "10.10.10.10",
          "x-forwarded-proto": "http",
          "x-forwarded-for": "10.10.10.10, 192.168.1.1, 10.255.255.255",
        },
      }, {
        conn: {
          remoteAddr: {
            transport: "tcp",
            port: 8080,
            hostname: "10.255.255.255",
          },
        } as Deno.Conn,
      }),
      { proxy: true, secure: true },
    );
    assertEquals(request.secure, true);
    assertEquals(request.url.hostname, "10.10.10.10");
    assertEquals(request.url.protocol, "http:");
    assertEquals(request.ip, "10.10.10.10");
    assertEquals(request.ips, ["10.10.10.10", "192.168.1.1", "10.255.255.255"]);
  },
});

test({
  name: "request with invalid JSON",
  async fn() {
    const body = "random text, but not JSON";
    const request = new Request(
      createMockNativeRequest("http://localhost/index.html", {
        body,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(body.length),
        },
      }),
    );
    assert(request.hasBody, "should have body");
    const actual = request.body();
    assert(actual.type === "json", "should be a JSON body");
    await assertRejects(
      async () => {
        await actual.value;
      },
      SyntaxError,
    );
  },
});

test({
  name: "Request - inspecting",
  fn() {
    assertEquals(
      Deno.inspect(
        new Request(
          createMockNativeRequest("http://localhost/foo?bar=baz&qat=qux", {
            headers: { host: "localhost" },
          }),
        ),
      ),
      isNode()
        ? `Request {\n  hasBody: false,\n  headers: HeadersList {\n    [Symbol(headers map)]: [Map],\n    [Symbol(headers map sorted)]: null\n  },\n  ip: '',\n  ips: [],\n  method: 'GET',\n  secure: false,\n  url: URL {\n    href: 'http://localhost/foo?bar=baz&qat=qux',\n    origin: 'http://localhost',\n    protocol: 'http:',\n    username: '',\n    password: '',\n    host: 'localhost',\n    hostname: 'localhost',\n    port: '',\n    pathname: '/foo',\n    search: '?bar=baz&qat=qux',\n    searchParams: URLSearchParams { 'bar' => 'baz', 'qat' => 'qux' },\n    hash: ''\n  }\n}`
        : `Request {\n  hasBody: false,\n  headers: Headers { host: "localhost" },\n  ip: "",\n  ips: [],\n  method: "GET",\n  secure: false,\n  url: "http://localhost/foo?bar=baz&qat=qux"\n}`,
    );
  },
});
