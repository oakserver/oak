// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertRejects, Buffer } from "./test_deps.ts";

import { BufReader } from "./buf_reader.ts";
import { readHeaders, toParamRegExp, unquote } from "./headers.ts";

const { test } = Deno;

test({
  name: "headers - toParamRegExp()",
  fn() {
    assertEquals(`foo=bar`.match(toParamRegExp("foo"))![1], "bar");
    assertEquals(`foo="bar"`.match(toParamRegExp("foo"))![1], `"bar"`);
    assertEquals(`bar="baz"; foo=bar`.match(toParamRegExp("foo"))![1], "bar");
    assertEquals(`foobar=bar`.match(toParamRegExp("foo")), null);
    assertEquals(`foo1=bar`.match(toParamRegExp("foo[0-9]"))![1], "bar");
  },
});

const fixture = `Content-Disposition: form-data; name="foo"; filename="foo.ts"
Content-Type: application/typescript

console.log("hello");
`;

const malformedFixture =
  `Content-Disposition: form-data; name="foo"; filename="foo.ts"
Content-Type: application/typescript
foobar

console.log("hello");
`;

const invalidHeaderKeyFixture =
  `Content-Disposition: form-data; name="foo"; filename="foo.ts"
Content-Type: application/typescript
:bar

console.log("hello");
`;

const unexpectedEndFixture =
  `Content-Disposition: form-data; name="foo"; filename="foo.ts"
Content-Type: application/typescript
`;

test({
  name: "headers - readHeaders()",
  async fn() {
    const body = new BufReader(
      new Buffer(new TextEncoder().encode(fixture)),
    );
    const actual = await readHeaders(body);
    assertEquals(
      actual["content-disposition"],
      `form-data; name="foo"; filename="foo.ts"`,
    );
    assertEquals(actual["content-type"], `application/typescript`);
    assertEquals(
      new TextDecoder().decode((await body.readLine())?.bytes),
      `console.log("hello");`,
    );
  },
});

test({
  name: "headers - readHeaders() Malformed header",
  async fn() {
    const body = new BufReader(
      new Buffer(new TextEncoder().encode(malformedFixture)),
    );
    await assertRejects(() => readHeaders(body), Error, "Malformed header:");
  },
});

test({
  name: "headers - readHeaders() Invalid header key",
  async fn() {
    const body = new BufReader(
      new Buffer(new TextEncoder().encode(invalidHeaderKeyFixture)),
    );
    await assertRejects(() => readHeaders(body), Error, "Invalid header key");
  },
});

test({
  name: "headers - readHeaders() Unexpected end of body reached",
  async fn() {
    const body = new BufReader(
      new Buffer(new TextEncoder().encode(unexpectedEndFixture)),
    );
    await assertRejects(
      () => readHeaders(body),
      Error,
      "Unexpected end of body reached.",
    );
  },
});

test({
  name: "headers - unquote()",
  fn() {
    assertEquals(unquote("bar"), "bar");
    assertEquals(unquote(`"bar"`), "bar");
    assertEquals(unquote(`\"bar\"`), "bar");
  },
});
