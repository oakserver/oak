// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals } from "./test_deps.ts";

import { cloneState } from "./structured_clone.ts";

const { test } = Deno;

test({
  name: "basic cloning",
  fn() {
    const fixture = { a: "a", b: 2, c: true };
    const actual = cloneState(fixture);
    assert(actual !== fixture);
    assertEquals(actual, fixture);
  },
});

test({
  name: "cloning state with functions",
  fn() {
    const fixture = { a: "a", b: () => {}, c: true };
    const actual = cloneState(fixture);
    // @ts-ignore we shouldn't have type inference in asserts!
    assertEquals(actual, { a: "a", c: true });
  },
});
