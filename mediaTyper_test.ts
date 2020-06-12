// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import {
  assertEquals,
  assertStrictEquals,
  assertThrows,
  test,
} from "./test_deps.ts";
import { format, parse } from "./mediaTyper.ts";

test({
  name: "format basic type",
  fn() {
    const actual = format({ type: "text", subtype: "html" });
    assertStrictEquals(actual, "text/html");
  },
});

test({
  name: "format type with suffic",
  fn() { // formatWithSuffix() {
    const actual = format({ type: "image", subtype: "svg", suffix: "xml" });
    assertStrictEquals(actual, "image/svg+xml");
  },
});

test({
  name: "format invalid type",
  fn() {
    assertThrows(
      () => {
        format({ type: "text/", subtype: "html" });
      },
      TypeError,
      "Invalid type",
    );
  },
});

test({
  name: "format invalid sub type",
  fn() {
    assertThrows(
      () => {
        format({ type: "text", subtype: "html/" });
      },
      TypeError,
      "Invalid subtype",
    );
  },
});

test({
  name: "format invalid suffix",
  fn() {
    assertThrows(
      () => {
        format({ type: "image", subtype: "svg", suffix: "xml\\" });
      },
      TypeError,
      "Invalid suffix",
    );
  },
});

test({
  name: "parse basic type",
  fn() {
    const actual = parse("text/html");
    assertEquals(actual, { type: "text", subtype: "html", suffix: undefined });
  },
});

test({
  name: "parse with suffix",
  fn() {
    const actual = parse("image/svg+xml");
    assertEquals(actual, { type: "image", subtype: "svg", suffix: "xml" });
  },
});

test({
  name: "parse is case insensitive",
  fn() {
    const actual = parse("IMAGE/SVG+XML");
    assertEquals(actual, { type: "image", subtype: "svg", suffix: "xml" });
  },
});

const invalidTypes = [
  " ",
  "null",
  "undefined",
  "/",
  "text/;plain",
  'text/"plain"',
  "text/p£ain",
  "text/(plain)",
  "text/@plain",
  "text/plain,wrong",
];

for (const type of invalidTypes) {
  test({
    name: `parse invalidType: "${type}"`,
    fn() {
      assertThrows(
        () => {
          parse(type);
        },
        TypeError,
        "Invalid media type",
      );
    },
  });
}
