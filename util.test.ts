// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { assert, errors } from "./deps.ts";
import { assertEquals, assertThrows } from "./test_deps.ts";
import { decodeComponent, getRandomFilename, resolvePath } from "./util.ts";

Deno.test({
  name: "decodeComponent",
  fn() {
    // with decodeURIComponent, this would throw:
    assertEquals(decodeComponent("%"), "%");
  },
});

Deno.test({
  name: "resolvePath",
  fn() {
    assertEquals(
      resolvePath("./foo/bar").replace(/\\/g, "/"),
      `foo/bar`,
    );
  },
});

Deno.test({
  name: "resolvePath outside of root",
  fn() {
    assertThrows(() => {
      resolvePath("../foo/bar");
    }, errors.Forbidden);
  },
});

Deno.test({
  name: "resolvePath outside of root devious",
  fn() {
    assertThrows(() => {
      resolvePath("foo/../../bar");
    }, errors.Forbidden);
  },
});

Deno.test({
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

Deno.test({
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

Deno.test({
  name: "resolvePath from root",
  fn() {
    assert(
      resolvePath("/public", "./foo/bar").replace(/\\/g, "/").endsWith(
        "/public/foo/bar",
      ),
    );
  },
});

Deno.test({
  name: "getRandomFilename()",
  async fn() {
    const actual = await getRandomFilename("foo", "bar");
    assert(actual.startsWith("foo"));
    assert(actual.endsWith(".bar"));
    assert(actual.length > 7);
  },
});
