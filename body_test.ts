// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { RequestBody } from "./body.ts";
import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
  test,
} from "./test_deps.ts";
import type { ServerRequest } from "./types.d.ts";
import { decoder } from "https://deno.land/std@0.59.0/encoding/utf8.ts";

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
    body,
    headerValues = {},
    proto = "HTTP/1.1",
  }: MockServerRequestOptions = {},
): ServerRequest {
  const headers = new Headers();
  headers.set("host", host);
  for (const [key, value] of Object.entries(headerValues)) {
    headers.set(key, value);
  }
  if (body && body.length && !headers.has("content-length")) {
    headers.set("content-length", String(body.length));
  }
  return {
    headers,
    method: "GET",
    url,
    proto,
    body: body && createMockBodyReader(body),
    async respond() {},
  } as any;
}

const multipartContentType =
  `multipart/form-data; boundary=OAK-SERVER-BOUNDARY`;

const multipartFixture = `
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="hello"

world
--OAK-SERVER-BOUNDARY--
`;

test({
  name: "body - form",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: `foo=bar&bar=1&baz=qux+%2B+quux`,
        headerValues: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    ));
    assert(requestBody.has());
    const body = requestBody.get({});
    assert(body.type === "form");
    const actual = await body.value;
    assertEquals(
      Array.from(actual.entries()),
      [["foo", "bar"], ["bar", "1"], ["baz", "qux + quux"]],
    );
  },
});

test({
  name: "body - form-data",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: multipartFixture,
        headerValues: {
          "content-type": multipartContentType,
        },
      },
    ));
    assert(requestBody.has());
    const body = requestBody.get({});
    assert(body.type === "form-data");
    const actual = await body.value.read();
    assertEquals(actual.fields, { hello: "world" });
  },
});

test({
  name: "body - json",
  async fn() {
    const requestBody = new RequestBody(
      createMockServerRequest(
        {
          body: JSON.stringify({ hello: "world" }),
          headerValues: { "content-type": "application/json" },
        },
      ),
    );
    assert(requestBody.has());
    const body = requestBody.get({});
    assert(body.type === "json");
    assertEquals(await body.value, { hello: "world" });
  },
});

test({
  name: "body - raw",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: `console.log("hello world!");\n`,
        headerValues: {
          "content-type": "application/javascript",
        },
      },
    ));
    assert(requestBody.has());
    const body = requestBody.get({});
    assert(body.type === "raw");
    const actual = await body.value;
    assertEquals(decoder.decode(actual), `console.log("hello world!");\n`);
  },
});

test({
  name: "body - text",
  async fn() {
    const requestBody = new RequestBody(
      createMockServerRequest(
        { body: "hello", headerValues: { "content-type": "text/plain" } },
      ),
    );
    assert(requestBody.has());
    const body = requestBody.get({});
    assert(body.type === "text");
    assertEquals(await body.value, "hello");
  },
});

test({
  name: "body - undefined",
  fn() {
    const requestBody = new RequestBody(createMockServerRequest());
    assertEquals(requestBody.has(), false);
    const body = requestBody.get({});
    assert(body.type === "undefined");
    assertEquals(body.value, undefined);
  },
});

test({
  name: "body - type: reader",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest({
      body: "hello world",
      headerValues: {
        "content-type": "text/plain",
      },
    }));
    const body = requestBody.get({ type: "reader" });
    assert(body.type === "reader");
    const actual = await Deno.readAll(body.value);
    assertEquals(decoder.decode(actual), "hello world");
  },
});

test({
  name: "body - type: form",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: `foo=bar&bar=1&baz=qux+%2B+quux`,
        headerValues: {
          "Content-Type": "application/javascript",
        },
      },
    ));
    const body = requestBody.get({ type: "form" });
    assert(body.type === "form");
    const actual = await body.value;
    assertEquals(
      Array.from(actual.entries()),
      [["foo", "bar"], ["bar", "1"], ["baz", "qux + quux"]],
    );
  },
});

test({
  name: "body - type: form-data",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: multipartFixture,
        headerValues: {
          "content-type":
            "application/javascript; boundary=OAK-SERVER-BOUNDARY",
        },
      },
    ));
    const body = requestBody.get({ type: "form-data" });
    assert(body.type === "form-data");
    const actual = await body.value.read();
    assertEquals(actual.fields, { hello: "world" });
  },
});

test({
  name: "body - type: raw",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: `console.log("hello world!");\n`,
        headerValues: {
          "content-type": "text/plain",
        },
      },
    ));
    const body = requestBody.get({ type: "raw" });
    assert(body.type === "raw");
    const actual = await body.value;
    assertEquals(decoder.decode(actual), `console.log("hello world!");\n`);
  },
});

test({
  name: "body - type: json",
  async fn() {
    const requestBody = new RequestBody(
      createMockServerRequest(
        {
          body: JSON.stringify({ hello: "world" }),
          headerValues: { "content-type": "application/javascript" },
        },
      ),
    );
    const body = requestBody.get({ type: "json" });
    assert(body.type === "json");
    assertEquals(await body.value, { hello: "world" });
  },
});

test({
  name: "body - type: text",
  async fn() {
    const requestBody = new RequestBody(
      createMockServerRequest(
        {
          body: "hello",
          headerValues: { "content-type": "application/javascript" },
        },
      ),
    );
    const body = requestBody.get({ type: "text" });
    assert(body.type === "text");
    assertEquals(await body.value, "hello");
  },
});

test({
  name: "body - type - body undefined",
  fn() {
    const requestBody = new RequestBody(createMockServerRequest());
    assertEquals(requestBody.has(), false);
    assertThrows(
      () => {
        requestBody.get({ type: "text" });
      },
      TypeError,
      `Body is undefined and cannot be returned as "text".`,
    );
  },
});

test({
  name: "body - contentTypes: form",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: `foo=bar&bar=1&baz=qux+%2B+quux`,
        headerValues: {
          "Content-Type": "application/javascript",
        },
      },
    ));
    const body = requestBody.get(
      { contentTypes: { form: ["application/javascript"] } },
    );
    assert(body.type === "form");
    const actual = await body.value;
    assertEquals(
      Array.from(actual.entries()),
      [["foo", "bar"], ["bar", "1"], ["baz", "qux + quux"]],
    );
  },
});

test({
  name: "body - contentTypes: form-data",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: multipartFixture,
        headerValues: {
          "content-type":
            "application/javascript; boundary=OAK-SERVER-BOUNDARY",
        },
      },
    ));
    const body = requestBody.get(
      { contentTypes: { formData: ["application/javascript"] } },
    );
    assert(body.type === "form-data");
    const actual = await body.value.read();
    assertEquals(actual.fields, { hello: "world" });
  },
});

test({
  name: "body - contentTypes: raw",
  async fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: `console.log("hello world!");\n`,
        headerValues: {
          "content-type": "text/plain",
        },
      },
    ));
    const body = requestBody.get({ contentTypes: { raw: ["text/plain"] } });
    assert(body.type === "raw");
    const actual = await body.value;
    assertEquals(decoder.decode(actual), `console.log("hello world!");\n`);
  },
});

test({
  name: "body - contentTypes: json",
  async fn() {
    const requestBody = new RequestBody(
      createMockServerRequest(
        {
          body: JSON.stringify({ hello: "world" }),
          headerValues: { "content-type": "application/javascript" },
        },
      ),
    );
    const body = requestBody.get(
      { contentTypes: { json: ["application/javascript"] } },
    );
    assert(body.type === "json");
    assertEquals(await body.value, { hello: "world" });
  },
});

test({
  name: "body - contentTypes: text",
  async fn() {
    const requestBody = new RequestBody(
      createMockServerRequest(
        {
          body: "hello",
          headerValues: { "content-type": "application/javascript" },
        },
      ),
    );
    const body = requestBody.get(
      { contentTypes: { text: ["application/javascript"] } },
    );
    assert(body.type === "text");
    assertEquals(await body.value, "hello");
  },
});

test({
  name: "body - multiple gets memoized",
  fn() {
    const requestBody = new RequestBody(createMockServerRequest(
      {
        body: `console.log("hello world!");\n`,
        headerValues: {
          "content-type": "application/javascript",
        },
      },
    ));
    const a = requestBody.get({});
    const b = requestBody.get({});
    assertStrictEquals(a.type, b.type);
    assertStrictEquals(a.value, b.value);
    assert(a !== b);
  },
});

test({
  name: "body - can get different types",
  async fn() {
    const body = JSON.stringify({ hello: "world" });
    const requestBody = new RequestBody(
      createMockServerRequest(
        {
          body,
          headerValues: { "content-type": "application/json" },
        },
      ),
    );
    const textBody = requestBody.get({ type: "text" });
    assert(textBody.type === "text");
    assertEquals(await textBody.value, body);
    const bodyJson = requestBody.get({});
    assert(bodyJson.type === "json");
    assertEquals(await bodyJson.value, { hello: "world" });
  },
});
