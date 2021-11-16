import * as denoShim from "deno.ns";
// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals } from "./test_deps.js";

import { cloneState } from "./structured_clone.js";

const { test } = denoShim.Deno;

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
    assertEquals(actual, { a: "a", c: true });
  },
});
