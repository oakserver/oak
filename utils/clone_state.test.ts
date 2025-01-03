// Copyright 2018-2025 the oak authors. All rights reserved. MIT license.

import { assertEquals } from "../deps_test.ts";

import { assert } from "../deps.ts";
import { cloneState } from "./clone_state.ts";

Deno.test({
  name: "basic cloning",
  fn() {
    const fixture = { a: "a", b: 2, c: true };
    const actual = cloneState(fixture);
    assert(actual !== fixture);
    assertEquals(actual, fixture);
  },
});

Deno.test({
  name: "cloning state with functions",
  fn() {
    const fixture = { a: "a", b: () => {}, c: true };
    const actual = cloneState(fixture);
    // @ts-ignore we shouldn't have type inference in asserts!
    assertEquals(actual, { a: "a", c: true });
  },
});
