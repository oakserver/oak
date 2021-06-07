// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals } from "./test_deps.ts";

import { structuredClone } from "./structured_clone.ts";

const { test } = Deno;

test({
  name: "basic structured clone",
  fn() {
    const fixture = { a: "a", b: 2, c: true };
    const actual = structuredClone(fixture);
    assert(actual !== fixture);
    assertEquals(actual, fixture);
  },
});
