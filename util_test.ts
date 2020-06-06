// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, assertThrows, test } from "./test_deps.ts";
import { httpErrors } from "./httpError.ts";
import { decodeComponent, getRandomFilename, resolvePath } from "./util.ts";

const encoder = new TextEncoder();

test({
  name: "decodeComponent",
  fn() {
    // with decodeURIComponent, this would throw:
    assertEquals(decodeComponent("%"), "%");
  },
});

test({
  name: "resolvePath",
  fn() {
    assertEquals(resolvePath("./foo/bar"), `${Deno.cwd()}/foo/bar`);
  },
});

test({
  name: "resolvePath outside of root",
  fn() {
    assertThrows(() => {
      resolvePath("../foo/bar");
    }, httpErrors.Forbidden);
  },
});

test({
  name: "resolvePath outside of root devious",
  fn() {
    assertThrows(() => {
      resolvePath("foo/../../bar");
    }, httpErrors.Forbidden);
  },
});

test({
  name: "resolvePath absolute",
  fn() {
    assertThrows(
      () => {
        resolvePath("/dev/null");
      },
      httpErrors.BadRequest,
      "Malicious Path",
    );
  },
});

test({
  name: "resolvePath contains null",
  fn() {
    assertThrows(
      () => {
        resolvePath("./foo/bar\0baz");
      },
      httpErrors.BadRequest,
      "Malicious Path",
    );
  },
});

test({
  name: "resolvePath from root",
  fn() {
    assertEquals(resolvePath("/public", "./foo/bar"), "/public/foo/bar");
  },
});

test({
  name: "getRandomFilename()",
  fn() {
    const actual = getRandomFilename("foo", "bar");
    assert(actual.startsWith("foo"));
    assert(actual.endsWith(".bar"));
    assert(actual.length > 7);
  },
});
