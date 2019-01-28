// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { assert, test } from "https://deno.land/x/std/testing/mod.ts";
import { format, parse } from "./mediaTyper.ts";

test(function formatBasicType() {
  const actual = format({ type: "text", subtype: "html" });
  assert.strictEqual(actual, "text/html");
});

test(function formatWithSuffix() {
  const actual = format({ type: "image", subtype: "svg", suffix: "xml" });
  assert.strictEqual(actual, "image/svg+xml");
});

test(function invalidType() {
  assert.throws(
    () => {
      format({ type: "text/", subtype: "html" });
    },
    TypeError,
    "Invalid type"
  );
});

test(function invalidSubType() {
  assert.throws(
    () => {
      format({ type: "text", subtype: "html/" });
    },
    TypeError,
    "Invalid subtype"
  );
});

test(function invalidSubType() {
  assert.throws(
    () => {
      format({ type: "image", subtype: "svg", suffix: "xml\\" });
    },
    TypeError,
    "Invalid suffix"
  );
});

test(function parseBasicType() {
  const actual = parse("text/html");
  assert.equal(actual, { type: "text", subtype: "html", suffix: undefined });
});

test(function parseWithSuffix() {
  const actual = parse("image/svg+xml");
  assert.equal(actual, { type: "image", subtype: "svg", suffix: "xml" });
});

test(function parseLowerCase() {
  const actual = parse("IMAGE/SVG+XML");
  assert.equal(actual, { type: "image", subtype: "svg", suffix: "xml" });
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
  "text/plain,wrong"
];

for (const type of invalidTypes) {
  test({
    name: `invalidType: "${type}"`,
    fn() {
      assert.throws(
        () => {
          parse(type);
        },
        TypeError,
        "Invalid media type"
      );
    }
  });
}
