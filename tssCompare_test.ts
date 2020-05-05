// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.
import { assert } from "./test_deps.ts";
import { compare } from "./tssCompare.ts";

const { test } = Deno;

test({
  name: "string comparison - equal",
  fn() {
    assert(compare("a", "a"));
  },
});

test({
  name: "string comparison - not equal",
  fn() {
    assert(!compare("a", "b"));
  },
});

test({
  name: "number array comparison - equal",
  fn() {
    assert(compare([212, 213], [212, 213]));
  },
});

test({
  name: "number array comparison - not equal",
  fn() {
    assert(!compare([212, 213], [212, 212]));
  },
});

test({
  name: "ArrayBuffer comparison - equal",
  fn() {
    const a = new ArrayBuffer(2);
    const va = new DataView(a);
    va.setUint8(0, 212);
    va.setUint8(1, 213);
    const b = new ArrayBuffer(2);
    const vb = new DataView(b);
    vb.setUint8(0, 212);
    vb.setUint8(1, 213);
    assert(compare(a, b));
  },
});

test({
  name: "ArrayBuffer comparison - not equal",
  fn() {
    const a = new ArrayBuffer(2);
    const va = new DataView(a);
    va.setUint8(0, 212);
    va.setUint8(1, 213);
    const b = new ArrayBuffer(2);
    const vb = new DataView(b);
    vb.setUint8(0, 212);
    vb.setUint8(1, 212);
    assert(!compare(a, b));
  },
});

test({
  name: "Uint8Array comparison - equal",
  fn() {
    const a = new Uint8Array([212, 213]);
    const b = new Uint8Array([212, 213]);
    assert(compare(a, b));
  },
});

test({
  name: "Uint8Array comparison - not equal",
  fn() {
    const a = new Uint8Array([212, 213]);
    const b = new Uint8Array([212, 212]);
    assert(!compare(a, b));
  },
});
