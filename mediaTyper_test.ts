// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import {
  assertEquals,
  assertStrictEq,
  assertThrows,
  test,
} from "./test_deps.ts";
import { format, parse } from "./mediaTyper.ts";

test("formatBasicType", function () {
  const actual = format({ type: "text", subtype: "html" });
  assertStrictEq(actual, "text/html");
});

test("formatWithSuffix", function () {
  const actual = format({ type: "image", subtype: "svg", suffix: "xml" });
  assertStrictEq(actual, "image/svg+xml");
});

test("invalidType", function () {
  assertThrows(
    () => {
      format({ type: "text/", subtype: "html" });
    },
    TypeError,
    "Invalid type",
  );
});

test("invalidSubType", function () {
  assertThrows(
    () => {
      format({ type: "text", subtype: "html/" });
    },
    TypeError,
    "Invalid subtype",
  );
});

test("invalidSubType", function () {
  assertThrows(
    () => {
      format({ type: "image", subtype: "svg", suffix: "xml\\" });
    },
    TypeError,
    "Invalid suffix",
  );
});

test("parseBasicType", function () {
  const actual = parse("text/html");
  assertEquals(actual, { type: "text", subtype: "html", suffix: undefined });
});

test("parseWithSuffix", function () {
  const actual = parse("image/svg+xml");
  assertEquals(actual, { type: "image", subtype: "svg", suffix: "xml" });
});

test("parseLowerCase", function () {
  const actual = parse("IMAGE/SVG+XML");
  assertEquals(actual, { type: "image", subtype: "svg", suffix: "xml" });
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
    name: `invalidType: "${type}"`,
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
