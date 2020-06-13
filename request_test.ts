// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import {
  test,
  assert,
  assertEquals,
  assertStrictEquals,
} from "./test_deps.ts";
import { ServerRequest } from "./deps.ts";
import { Request } from "./request.ts";

const decoder = new TextDecoder();
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
  host?: string;
  body?: string;
  headerValues?: Record<string, string>;
  proto?: string;
  conn?: {
    remoteAddr: {
      hostname: string;
    };
  };
}

function createMockServerRequest(
  {
    url = "/",
    host = "localhost",
    body = "",
    headerValues = {},
    proto = "HTTP/1.1",
    conn = {
      remoteAddr: {
        hostname: "127.0.0.1",
      },
    },
  }: MockServerRequestOptions = {},
): ServerRequest {
  const headers = new Headers();
  headers.set("host", host);
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
    const mockServerRequest = createMockServerRequest({
      host: "oakserver.github.io:8080",
      url: "/foo/bar/baz?up=down",
      proto: "HTTP/1.1",
    });
    const request = new Request(mockServerRequest, false, true);
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
    const mockServerRequest = createMockServerRequest();
    const request = new Request(mockServerRequest);
    assertStrictEquals(request.serverRequest, mockServerRequest);
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
  fn() {
    const request = new Request(createMockServerRequest({ url: "/" }));
    assertEquals(request.accepts("application/json"), undefined);
  },
});

test({
  name: "request.accepts no match",
  fn() {
    const request = new Request(
      createMockServerRequest({ headerValues: { Accept: "text/html" } }),
    );
    assertEquals(request.accepts("application/json"), undefined);
  },
});

test({
  name: "request.body JSON",
  async fn() {
    const request = new Request(
      createMockServerRequest({
        body: `{"foo":"bar"}`,
        headerValues: {
          "Content-Type": "application/json",
        },
      }),
    );
    assertEquals(await request.body(), {
      type: "json",
      value: { foo: "bar" },
    });
  },
});

test({
  name: "request.body Form URLEncoded",
  async fn() {
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
    assertEquals(actual.type, "form");
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
  async fn() {
    const request = new Request(
      createMockServerRequest({
        body: "hello world!",
        headerValues: {
          "Content-Type": "text/plain",
        },
      }),
    );
    assertEquals(await request.body(), {
      type: "text",
      value: "hello world!",
    });
  },
});

test({
  name: "request.body({ asReader: true })",
  async fn() {
    const request = new Request(
      createMockServerRequest({
        body: "foo",
        headerValues: {
          "Content-Type": "text/plain",
        },
      }),
    );
    const actual = await request.body({ asReader: true });
    assertEquals(actual.type, "reader");
    assertEquals(decoder.decode(await Deno.readAll(actual.value)), "foo");
  },
});

test({
  name: "request.body(contentTypes)",
  async fn() {
    const request = new Request(
      createMockServerRequest({
        body: "console.log('hello world!');",
        headerValues: {
          "Content-Type": "application/javascript",
        },
      }),
    );
    assertEquals(
      await request.body(
        { contentTypes: { text: ["application/javascript"] } },
      ),
      {
        type: "text",
        value: "console.log('hello world!');",
      },
    );
  },
});

test({
  name: "request.body(contentTypes) does not overwrite",
  async fn() {
    const request = new Request(
      createMockServerRequest({
        body: "hello world!",
        headerValues: {
          "Content-Type": "text/plain",
        },
      }),
    );
    assertEquals(
      await request.body(
        { contentTypes: { text: ["application/javascript"] } },
      ),
      {
        type: "text",
        value: "hello world!",
      },
    );
  },
});

test({
  name: "request.body resolves undefined",
  async fn() {
    const request = new Request(createMockServerRequest());
    assertEquals(await request.body(), {
      type: "undefined",
      value: undefined,
    });
  },
});

test({
  name: "request.body unsupported media type",
  async fn() {
    const request = new Request(
      createMockServerRequest({
        body: "blah",
        headerValues: {
          "Content-Type": "application/graphql",
        },
      }),
    );
    const actual = await request.body();
    assertEquals(actual.type, "raw");
    assert(actual.value instanceof Uint8Array);
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
  name: "request.secure is true",
  fn() {
    const request = new Request(
      createMockServerRequest(),
      false,
      true,
    );
    assertEquals(request.secure, true);
  },
});

test({
  name: "request with proxy true",
  fn() {
    const request = new Request(
      createMockServerRequest({
        headerValues: {
          "x-forwarded-host": "10.10.10.10",
          "x-forwarded-proto": "http",
          "x-forwarded-for": "10.10.10.10, 192.168.1.1, 10.255.255.255",
        },
        conn: {
          remoteAddr: {
            hostname: "10.255.255.255",
          },
        },
      }),
      true,
      true,
    );
    assertEquals(request.secure, true);
    assertEquals(request.url.hostname, "10.10.10.10");
    assertEquals(request.url.protocol, "http:");
    assertEquals(request.ip, "10.10.10.10");
    assertEquals(request.ips, ["10.10.10.10", "192.168.1.1", "10.255.255.255"]);
  },
});
