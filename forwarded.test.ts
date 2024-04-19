// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { assertEquals } from "./deps_test.ts";

import { parse } from "./forwarded.ts";

Deno.test({
  name: "parses the pairs as expected",
  fn() {
    assertEquals(parse("foo=a,foo=b;bar=c;baz=d;qux=e"), [{ foo: "a" }, {
      foo: "b",
      bar: "c",
      baz: "d",
      qux: "e",
    }]);
  },
});

Deno.test({
  name: "handles double quotes and escaped characters",
  fn() {
    assertEquals(
      parse([
        'foo="bar"',
        'foo="ba\\r"',
        'foo=",;"',
        'foo=""',
        'foo=" "',
        'foo="\t"',
        'foo=" \t"',
        'foo="\\""',
        'foo="\\\\"',
        'foo="\\\\\\a"',
        'foo="¥"',
        'foo="\\§"',
      ].join(",")),
      [
        { foo: "bar" },
        { foo: "bar" },
        { foo: ",;" },
        { foo: "" },
        { foo: " " },
        { foo: "\t" },
        { foo: " \t" },
        { foo: '"' },
        { foo: "\\" },
        { foo: "\\a" },
        { foo: "¥" },
        { foo: "§" },
      ],
    );
  },
});

Deno.test({
  name: "ignores the optional white spaces",
  fn() {
    assertEquals(parse('foo=a,foo=b, foo="c" ,foo=d  ,  foo=e'), [
      { foo: "a" },
      { foo: "b" },
      { foo: "c" },
      { foo: "d" },
      { foo: "e" },
    ]);

    assertEquals(parse('foo=a;bar=b; baz=c ;qux="d"  ;  norf=e'), [{
      foo: "a",
      bar: "b",
      baz: "c",
      qux: "d",
      norf: "e",
    }]);
  },
});

Deno.test({
  name: "ignores the case of parameter names",
  fn() {
    assertEquals(parse(`foo=a,Foo=""`), [{ foo: "a" }, { foo: "" }]);
  },
});

Deno.test({
  name: "does not allow empty parameters",
  fn() {
    assertEquals(parse("foo=bar,=baz"), undefined);
  },
});

Deno.test({
  name: "returns undefined if a parameter is not made of 1*tchar",
  fn() {
    assertEquals(parse("f@r=192.0.2.43"), undefined);
  },
});
