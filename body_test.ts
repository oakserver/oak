// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { RequestBody } from "./body.ts";
import { readAll } from "./deps.ts";
import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "./test_deps.ts";

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

test({
  name: "body - form",
  async fn() {
    const requestBody = new RequestBody(
      new Request(
        "http://localhost/index.html",
        {
          body: `foo=bar&bar=1&baz=qux+%2B+quux`,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
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
    const requestBody = new RequestBody(
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
    );
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
      new Request(
        "http://localhost/index.html",
        {
          body: JSON.stringify({ hello: "world" }),
          method: "POST",
          headers: { "content-type": "application/json" },
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
  name: "body - bytes",
  async fn() {
    const requestBody = new RequestBody(
      new Request(
        "http://localhost/index.html",
        {
          body: `console.log("hello world!");\n`,
          method: "POST",
          headers: {
            "content-type": "application/javascript",
          },
        },
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: "hello",
        method: "POST",
        headers: { "content-type": "text/plain" },
      }),
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
      new Request("http://localhost/index.html"),
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
      new Request("http://localhost/index.html", {
        body: "hello world",
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
      }),
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
      new Request("http://localhost/index.html", {
        body: "hello world",
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
      }),
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: `foo=bar&bar=1&baz=qux+%2B+quux`,
        method: "POST",
        headers: {
          "Content-Type": "application/javascript",
        },
      }),
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
      new Request("http://localhost/index.html", {
        body: multipartFixture,
        method: "POST",
        headers: {
          "content-type":
            "application/javascript; boundary=OAK-SERVER-BOUNDARY",
        },
      }),
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: `console.log("hello world!");\n`,
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
      }),
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: JSON.stringify({ hello: "world" }),
        method: "POST",
        headers: { "content-type": "application/javascript" },
      }),
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
      new Request("http://localhost/index.html", {
        body: "hello",
        method: "POST",
        headers: { "content-type": "application/javascript" },
      }),
    );
    const body = requestBody.get({ type: "text" });
    assert(body.type === "text");
    assertEquals(await body.value, "hello");
  },
});

test({
  name: "body - type - body undefined",
  fn() {
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html"),
    );
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: `foo=bar&bar=1&baz=qux+%2B+quux`,
        method: "POST",
        headers: {
          "Content-Type": "application/javascript",
        },
      }),
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
      new Request("http://localhost/index.html", {
        body: multipartFixture,
        method: "POST",
        headers: {
          "content-type":
            "application/javascript; boundary=OAK-SERVER-BOUNDARY",
        },
      }),
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: `console.log("hello world!");\n`,
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
      }),
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: JSON.stringify({ hello: "world" }),
        method: "POST",
        headers: { "content-type": "application/javascript" },
      }),
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
      new Request("http://localhost/index.html", {
        body: "hello",
        method: "POST",
        headers: { "content-type": "application/javascript" },
      }),
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
    const requestBody = new RequestBody(
      new Request("http://localhost/index.html", {
        body: `console.log("hello world!");\n`,
        method: "POST",
        headers: {
          "content-type": "application/javascript",
        },
      }),
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
      new Request("http://localhost/index.html", {
        body,
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
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
      new Request("http://localhost/index.html", {
        body: "hello world",
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
      }),
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
