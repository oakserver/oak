// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assertEquals, Buffer } from "./test_deps.ts";

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
  name: "headers - unquote()",
  fn() {
    assertEquals(unquote("bar"), "bar");
    assertEquals(unquote(`"bar"`), "bar");
    assertEquals(unquote(`\"bar\"`), "bar");
  },
});
