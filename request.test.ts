// Copyright 2018-2025 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import { assert, isHttpError, Status } from "./deps.ts";
import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "./deps_test.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import type { NativeRequestInfo } from "./http_server_native_request.ts";
import { Request } from "./request.ts";
import { isNode } from "./utils/type_guards.ts";

function createMockNativeRequest(
  url = "http://localhost/index.html",
  requestInit: RequestInit = {},
  options: NativeRequestInfo = {},
) {
  const request: globalThis.Request = new (globalThis as any).Request(
    url,
    requestInit,
  );

  return new NativeRequest(request, options);
}

Deno.test({
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

Deno.test({
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

Deno.test({
  name: "request.userAgent",
  fn() {
    const mockServerRequest = createMockNativeRequest(
      "https://localhost/index.html",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        },
      },
    );
    const request = new Request(mockServerRequest);
    assertStrictEquals(request.userAgent.browser.name, "Chrome");
    assertStrictEquals(request.userAgent.device.model, "Macintosh");
  },
});

Deno.test({
  name: "request.serverRequest",
  fn() {
    const mockServerRequest = createMockNativeRequest();
    const request = new Request(mockServerRequest);
    assertStrictEquals(request.originalRequest, mockServerRequest);
  },
});

Deno.test({
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

Deno.test({
  name: "request.acceptsEncodings - no header",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html"),
    );
    assertEquals(request.acceptsEncodings("gzip", "identity"), "gzip");
  },
});

Deno.test({
  name: "request.acceptsEncodings - no header no encodings",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html"),
    );
    assertEquals(request.acceptsEncodings(), ["*"]);
  },
});

Deno.test({
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

Deno.test({
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

Deno.test({
  name: "request.accepts no header",
  fn() {
    const request = new Request(createMockNativeRequest("https://localhost/"));
    assertEquals(request.accepts("application/json"), "application/json");
  },
});

Deno.test({
  name: "request.accepts no header, no args",
  fn() {
    const request = new Request(createMockNativeRequest("https://localhost/"));
    assertEquals(request.accepts(), ["*/*"]);
  },
});

Deno.test({
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

Deno.test({
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
    assert(request.body.has);
    const actual = await request.body.json();
    assertEquals(actual, { hello: "world" });
  },
});

Deno.test({
  name: "request.secure is false",
  fn() {
    const request = new Request(createMockNativeRequest());
    assertEquals(request.secure, false);
  },
});

Deno.test({
  name: "request.secure is true",
  fn() {
    const request = new Request(
      createMockNativeRequest("https://localhost/index.html"),
      { proxy: false, secure: true },
    );
    assertEquals(request.secure, true);
  },
});

Deno.test({
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
        remoteAddr: {
          transport: "tcp",
          port: 8080,
          hostname: "10.255.255.255",
        },
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

Deno.test({
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
    const err = await assertRejects(
      async () => {
        await request.body.json();
      },
    );
    assert(isHttpError(err));
    assertEquals(err.status, Status.BadRequest);
  },
});

Deno.test({
  name: "Request - inspecting",
  ignore: true,
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
        ? `Request {\n  body: Body { has: false, used: false },\n  hasBody: false,\n  headers: HeadersList {\n    cookies: null,\n    [Symbol(headers map)]: [Map],\n    [Symbol(headers map sorted)]: null\n  },\n  ip: '',\n  ips: [],\n  method: 'GET',\n  secure: false,\n  url: URL {\n    href: 'http://localhost/foo?bar=baz&qat=qux',\n    origin: 'http://localhost',\n    protocol: 'http:',\n    username: '',\n    password: '',\n    host: 'localhost',\n    hostname: 'localhost',\n    port: '',\n    pathname: '/foo',\n    search: '?bar=baz&qat=qux',\n    searchParams: URLSearchParams { 'bar' => 'baz', 'qat' => 'qux' },\n    hash: ''\n  },\n  userAgent: UserAgent {\n    browser: [Object],\n    cpu: [Object],\n    device: [Object],\n    engine: [Object],\n    os: [Object],\n    ua: ''\n  }\n}`
        : `Request {\n  body: Body { has: false, used: false },\n  hasBody: false,\n  headers: Headers { host: "localhost" },\n  ip: "",\n  ips: [],\n  method: "GET",\n  secure: false,\n  url: "http://localhost/foo?bar=baz&qat=qux",\n  userAgent: UserAgent {\n  browser: { name: undefined, version: undefined, major: undefined },\n  cpu: { architecture: undefined },\n  device: { model: undefined, type: undefined, vendor: undefined },\n  engine: { name: undefined, version: undefined },\n  os: { name: undefined, version: undefined },\n  ua: ""\n}\n}`,
    );
  },
});
