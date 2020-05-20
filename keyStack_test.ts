// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { KeyStack } from "./keyStack.ts";
import { assert, assertEquals } from "./test_deps.ts";
const { test } = Deno;

test({
  name: "keyStack.sign() - single key",
  fn() {
    const keys = ["hello"];
    const keyStack = new KeyStack(keys);
    const actual = keyStack.sign("world");
    const expected = "8ayXAutfryPKKRpNxG3t3u4qeMza8KQSvtdxTP_7HMQ";
    assertEquals(actual, expected);
  },
});

test({
  name: "keyStack.sign() - two keys, first key used",
  fn() {
    const keys = ["hello", "world"];
    const keyStack = new KeyStack(keys);
    const actual = keyStack.sign("world");
    const expected = "8ayXAutfryPKKRpNxG3t3u4qeMza8KQSvtdxTP_7HMQ";
    assertEquals(actual, expected);
  },
});

test({
  name: "keyStack.verify() - single key",
  fn() {
    const keys = ["hello"];
    const keyStack = new KeyStack(keys);
    const digest = keyStack.sign("world");
    assert(keyStack.verify("world", digest));
  },
});

test({
  name: "keyStack.verify() - single key verify invalid",
  fn() {
    const keys = ["hello"];
    const keyStack = new KeyStack(keys);
    const digest = keyStack.sign("world");
    assert(!keyStack.verify("worlds", digest));
  },
});

test({
  name: "keyStack.verify() - two keys",
  fn() {
    const keys = ["hello", "world"];
    const keyStack = new KeyStack(keys);
    const digest = keyStack.sign("world");
    assert(keyStack.verify("world", digest));
  },
});

test({
  name: "keyStack.verify() - unshift key",
  fn() {
    const keys = ["hello"];
    const keyStack = new KeyStack(keys);
    const digest = keyStack.sign("world");
    keys.unshift("world");
    assertEquals(keys, ["world", "hello"]);
    assert(keyStack.verify("world", digest));
  },
});

test({
  name: "keyStack.verify() - shift key",
  fn() {
    const keys = ["hello", "world"];
    const keyStack = new KeyStack(keys);
    const digest = keyStack.sign("world");
    assertEquals(keys.shift(), "hello");
    assertEquals(keys, ["world"]);
    assert(!keyStack.verify("world", digest));
  },
});

test({
  name: "keyStack.indexOf() - single key",
  fn() {
    const keys = ["hello"];
    const keyStack = new KeyStack(keys);
    assertEquals(
      keyStack.indexOf("world", "8ayXAutfryPKKRpNxG3t3u4qeMza8KQSvtdxTP_7HMQ"),
      0,
    );
  },
});

test({
  name: "keyStack.indexOf() - two keys index 0",
  fn() {
    const keys = ["hello", "world"];
    const keyStack = new KeyStack(keys);
    assertEquals(
      keyStack.indexOf("world", "8ayXAutfryPKKRpNxG3t3u4qeMza8KQSvtdxTP_7HMQ"),
      0,
    );
  },
});

test({
  name: "keyStack.indexOf() - two keys index 1",
  fn() {
    const keys = ["world", "hello"];
    const keyStack = new KeyStack(keys);
    assertEquals(
      keyStack.indexOf("world", "8ayXAutfryPKKRpNxG3t3u4qeMza8KQSvtdxTP_7HMQ"),
      1,
    );
  },
});

test({
  name: "keyStack.indexOf() - two keys not found",
  fn() {
    const keys = ["world", "hello"];
    const keyStack = new KeyStack(keys);
    assertEquals(
      keyStack.indexOf("hello", "8ayXAutfryPKKRpNxG3t3u4qeMza8KQSvtdxTP_7HMQ"),
      -1,
    );
  },
});

test({
  name: "keyStack - number array key",
  fn() {
    const keys = [[212, 213]];
    const keyStack = new KeyStack(keys);
    assert(keyStack.verify("hello", keyStack.sign("hello")));
  },
});

test({
  name: "keyStack - Uint8Array key",
  fn() {
    const keys = [new Uint8Array([212, 213])];
    const keyStack = new KeyStack(keys);
    assert(keyStack.verify("hello", keyStack.sign("hello")));
  },
});

test({
  name: "keyStack - ArrayBuffer key",
  fn() {
    const key = new ArrayBuffer(2);
    const dataView = new DataView(key);
    dataView.setInt8(0, 212);
    dataView.setInt8(1, 213);
    const keys = [key];
    const keyStack = new KeyStack(keys);
    assert(keyStack.verify("hello", keyStack.sign("hello")));
  },
});

test({
  name: "keyStack - number array data",
  fn() {
    const keys = [[212, 213]];
    const keyStack = new KeyStack(keys);
    assert(keyStack.verify([212, 213], keyStack.sign([212, 213])));
  },
});

test({
  name: "keyStack - Uint8Array data",
  fn() {
    const keys = [[212, 213]];
    const keyStack = new KeyStack(keys);
    assert(
      keyStack.verify(
        new Uint8Array([212, 213]),
        keyStack.sign(new Uint8Array([212, 213])),
      ),
    );
  },
});

test({
  name: "keyStack - ArrayBuffer data",
  fn() {
    const keys = [[212, 213]];
    const keyStack = new KeyStack(keys);
    const data1 = new ArrayBuffer(2);
    const dataView1 = new DataView(data1);
    dataView1.setInt8(0, 212);
    dataView1.setInt8(1, 213);
    const data2 = new ArrayBuffer(2);
    const dataView2 = new DataView(data2);
    dataView2.setInt8(0, 212);
    dataView2.setInt8(1, 213);
    assert(keyStack.verify(data2, keyStack.sign(data1)));
  },
});
