// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { assertEquals } from "./test_deps.ts";

import { toParamRegExp, unquote } from "./headers.ts";

Deno.test({
  name: "headers - toParamRegExp()",
  fn() {
    assertEquals(`foo=bar`.match(toParamRegExp("foo"))![1], "bar");
    assertEquals(`foo="bar"`.match(toParamRegExp("foo"))![1], `"bar"`);
    assertEquals(`bar="baz"; foo=bar`.match(toParamRegExp("foo"))![1], "bar");
    assertEquals(`foobar=bar`.match(toParamRegExp("foo")), null);
    assertEquals(`foo1=bar`.match(toParamRegExp("foo[0-9]"))![1], "bar");
  },
});

Deno.test({
  name: "headers - unquote()",
  fn() {
    assertEquals(unquote("bar"), "bar");
    assertEquals(unquote(`"bar"`), "bar");
    assertEquals(unquote(`\"bar\"`), "bar");
  },
});
