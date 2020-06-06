// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assertEquals } from "./test_deps.ts";

import { BufReader } from "./buf_reader.ts";
import { toParamRegExp, readHeaders, unquote } from "./headers.ts";

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
      new Deno.Buffer(new TextEncoder().encode(fixture)),
    );
    const actual = await readHeaders(body);
    assertEquals(
      actual.get("content-disposition"),
      `form-data; name="foo"; filename="foo.ts"`,
    );
    assertEquals(actual.get("content-type"), `application/typescript`);
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
