// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { errors } from "./deps.ts";
import { assert, assertEquals, assertThrows } from "./test_deps.ts";
import { decodeComponent, getRandomFilename, resolvePath } from "./util.ts";

const { test } = Deno;

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
    assertEquals(
      resolvePath("./foo/bar").replace(/\\/g, "/"),
      `foo/bar`,
    );
  },
});

test({
  name: "resolvePath outside of root",
  fn() {
    assertThrows(() => {
      resolvePath("../foo/bar");
    }, errors.Forbidden);
  },
});

test({
  name: "resolvePath outside of root devious",
  fn() {
    assertThrows(() => {
      resolvePath("foo/../../bar");
    }, errors.Forbidden);
  },
});

test({
  name: "resolvePath absolute",
  fn() {
    assertThrows(
      () => {
        resolvePath("/dev/null");
      },
      errors.BadRequest,
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
      errors.BadRequest,
      "Malicious Path",
    );
  },
});

test({
  name: "resolvePath from root",
  fn() {
    assert(
      resolvePath("/public", "./foo/bar").replace(/\\/g, "/").endsWith(
        "/public/foo/bar",
      ),
    );
  },
});

test({
  name: "getRandomFilename()",
  async fn() {
    const actual = await getRandomFilename("foo", "bar");
    assert(actual.startsWith("foo"));
    assert(actual.endsWith(".bar"));
    assert(actual.length > 7);
  },
});
