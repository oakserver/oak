// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { RequestBody } from "./body.ts";
import { readAll } from "./deps.ts";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "./test_deps.ts";
import type { ServerRequestBody } from "./types.d.ts";

const { test } = Deno;

const decoder = new TextDecoder();

const multipartContentType =
  `multipart/form-data; boundary=OAK-SERVER-BOUNDARY`;

const multipartFixture = `
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="hello"

world
--OAK-SERVER-BOUNDARY--
`;

function toServerRequestBody(request: Request): [ServerRequestBody, Headers] {
  return [{
    // deno-lint-ignore no-explicit-any
    body: request.body as any,
    readBody: async () => {
      const ab = await request.arrayBuffer();
      return new Uint8Array(ab);
    },
  }, request.headers];
}

test({
  name: "body - form",
  async fn() {
    const rBody = `foo=bar&bar=1&baz=qux+%2B+quux`;
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request(
          "http://localhost/index.html",
          {
            body: rBody,
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": String(rBody.length),
            },
          },
        ),
      ),
    );
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
    const requestBody = new RequestBody(...toServerRequestBody(
      new Request(
        "http://localhost/index.html",
        {
          body: multipartFixture,
          method: "POST",
          headers: {
            "content-type": multipartContentType,
          },
        },
      ),
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
    const rBody = JSON.stringify({ hello: "world" });
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request(
          "http://localhost/index.html",
          {
            body: rBody,
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": String(rBody.length),
            },
          },
        ),
      ),
    );
    assert(requestBody.has());
    const body = requestBody.get({});
    assert(body.type === "json");
    assertEquals(await body.value, { hello: "world" });
  },
});

test({
  name: "body - bytes",
  async fn() {
    const rBody = `console.log("hello world!");\n`;
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request(
          "http://localhost/index.html",
          {
            body: rBody,
            method: "POST",
            headers: {
              "content-type": "application/javascript",
              "content-length": String(rBody.length),
            },
          },
        ),
      ),
    );
    assert(requestBody.has());
    const body = requestBody.get({});
    assert(body.type === "bytes");
    const actual = await body.value;
    assertEquals(decoder.decode(actual), `console.log("hello world!");\n`);
  },
});

test({
  name: "body - text",
  async fn() {
    const rBody = "hello";
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "content-length": String(rBody.length),
          },
        }),
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
    const requestBody = new RequestBody(
      ...toServerRequestBody(new Request("http://localhost/index.html")),
    );
    assertEquals(requestBody.has(), false);
    const body = requestBody.get({});
    assert(body.type === "undefined");
    assertEquals(body.value, undefined);
  },
});

test({
  name: "body - type: reader",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: "hello world",
          method: "POST",
          headers: {
            "content-type": "text/plain",
          },
        }),
      ),
    );
    const body = requestBody.get({ type: "reader" });
    assert(body.type === "reader");
    const actual = await readAll(body.value);
    assertEquals(decoder.decode(actual), "hello world");
  },
});

test({
  name: "body - type: stream",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: "hello world",
          method: "POST",
          headers: {
            "content-type": "text/plain",
          },
        }),
      ),
    );
    const body = requestBody.get({ type: "stream" });
    assert(body.type === "stream");
    const actual = await new Response(body.value).text();
    assertEquals(actual, "hello world");
  },
});

test({
  name: "body - type: form",
  async fn() {
    const rBody = `foo=bar&bar=1&baz=qux+%2B+quux`;
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "Content-Type": "application/javascript",
            "content-length": String(rBody.length),
          },
        }),
      ),
    );
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
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: multipartFixture,
          method: "POST",
          headers: {
            "content-type":
              "application/javascript; boundary=OAK-SERVER-BOUNDARY",
          },
        }),
      ),
    );
    const body = requestBody.get({ type: "form-data" });
    assert(body.type === "form-data");
    const actual = await body.value.read();
    assertEquals(actual.fields, { hello: "world" });
  },
});

test({
  name: "body - type: bytes",
  async fn() {
    const rBody = `console.log("hello world!");\n`;
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "content-length": String(rBody.length),
          },
        }),
      ),
    );
    const body = requestBody.get({ type: "bytes" });
    assert(body.type === "bytes");
    const actual = await body.value;
    assertEquals(decoder.decode(actual), `console.log("hello world!");\n`);
  },
});

test({
  name: "body - type: json",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "application/javascript",
            "content-length": String(rBody.length),
          },
        }),
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
    const rBody = "hello";
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "application/javascript",
            "content-length": String(rBody.length),
          },
        }),
      ),
    );
    const body = requestBody.get({ type: "text" });
    assert(body.type === "text");
    assertEquals(await body.value, "hello");
  },
});

test({
  name: "body - type - body undefined",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(new Request("http://localhost/index.html")),
    );
    assertEquals(requestBody.has(), false);
    const body = requestBody.get({ type: "text" });
    assert(body.type === "text");
    assertEquals(await body.value, "");
  },
});

test({
  name: "body - contentTypes: form",
  async fn() {
    const rBody = `foo=bar&bar=1&baz=qux+%2B+quux`;
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "Content-Type": "application/javascript",
            "content-length": String(rBody.length),
          },
        }),
      ),
    );
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
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: multipartFixture,
          method: "POST",
          headers: {
            "content-type":
              "application/javascript; boundary=OAK-SERVER-BOUNDARY",
          },
        }),
      ),
    );
    const body = requestBody.get(
      { contentTypes: { formData: ["application/javascript"] } },
    );
    assert(body.type === "form-data");
    const actual = await body.value.read();
    assertEquals(actual.fields, { hello: "world" });
  },
});

test({
  name: "body - contentTypes: bytes",
  async fn() {
    const rBody = `console.log("hello world!");\n`;
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "content-length": String(rBody.length),
          },
        }),
      ),
    );
    const body = requestBody.get({ contentTypes: { bytes: ["text/plain"] } });
    assert(body.type === "bytes");
    const actual = await body.value;
    assertEquals(decoder.decode(actual), `console.log("hello world!");\n`);
  },
});

test({
  name: "body - contentTypes: json",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "application/javascript",
            "content-length": String(rBody.length),
          },
        }),
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
    const rBody = "hello";
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "application/javascript",
            "content-length": String(rBody.length),
          },
        }),
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
    const rBody = `console.log("hello world!");\n`;
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: rBody,
          method: "POST",
          headers: {
            "content-type": "application/javascript",
            "content-length": String(rBody.length),
          },
        }),
      ),
    );
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
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": String(body.length),
          },
        }),
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

test({
  name: "body - multiple streams",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: "hello world",
          method: "POST",
          headers: {
            "content-type": "text/plain",
          },
        }),
      ),
    );
    const a = requestBody.get({ type: "stream" });
    const b = requestBody.get({ type: "stream" });
    assert(a.type === "stream");
    assert(b.type === "stream");
    const textA = await new Response(a.value).text();
    const textB = await new Response(b.value).text();
    assertEquals(textA, textB);
  },
});

test({
  name: "body - default limit no content type",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: "hello world",
          method: "POST",
          headers: {
            "content-type": "text/plain",
          },
        }),
      ),
    );
    const actual = requestBody.get();
    await assertRejects(
      async () => {
        await actual.value;
      },
      RangeError,
      "Body exceeds a limit of ",
    );
  },
});

test({
  name:
    "body - default limit, 0 content-length (content-length greater than or equal to zero is a valid value - https://datatracker.ietf.org/doc/html/rfc2616#section-14.13)",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: "",
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "content-length": "0",
          },
        }),
      ),
    );
    const actual = requestBody.get({ type: "text" });
    assertEquals(await actual.value, "");
  },
});

test({
  name: "body - limit set to 0",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: "hello world",
          method: "POST",
          headers: {
            "content-type": "text/plain",
          },
        }),
      ),
    );
    const actual = requestBody.get({ type: "text", limit: 0 });
    assertEquals(await actual.value, "hello world");
  },
});

test({
  name: "body - limit set to Infinity",
  async fn() {
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body: "hello world",
          method: "POST",
          headers: {
            "content-type": "text/plain",
          },
        }),
      ),
    );
    const actual = requestBody.get({ type: "text", limit: Infinity });
    assertEquals(await actual.value, "hello world");
  },
});

test({
  name: "body - limit set to 1000",
  async fn() {
    const body = "hello world";
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body,
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "content-length": String(body.length),
          },
        }),
      ),
    );
    const actual = requestBody.get({ type: "text", limit: 1000 });
    assertEquals(await actual.value, "hello world");
  },
});

test({
  name: "body - exceeds limit",
  async fn() {
    const body = "hello world";
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body,
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "content-length": String(body.length),
          },
        }),
      ),
    );
    const actual = requestBody.get({ type: "text", limit: 2 });
    await assertRejects(
      async () => {
        await actual.value;
      },
      RangeError,
      "Body exceeds a limit of ",
    );
  },
});

test({
  name: "body - exceeds limit but can retrieve with different limit",
  async fn() {
    const body = "hello world";
    const requestBody = new RequestBody(
      ...toServerRequestBody(
        new Request("http://localhost/index.html", {
          body,
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "content-length": String(body.length),
          },
        }),
      ),
    );
    let actual = requestBody.get({ type: "text", limit: 2 });
    await assertRejects(
      async () => {
        await actual.value;
      },
      RangeError,
      "Body exceeds a limit of ",
    );
    actual = requestBody.get();
    assertEquals(await actual.value, "hello world");
  },
});
