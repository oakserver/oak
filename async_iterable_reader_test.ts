// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, test } from "./test_deps.ts";

import { AsyncIterableReader } from "./async_iterable_reader.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

test({
  name: "AsyncIterableReader - basic",
  async fn() {
    const rs = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("hello deno");
        controller.close();
      },
    });

    const air = new AsyncIterableReader(rs, encoder.encode);

    let buf = new Uint8Array(1000);
    let bytesRead = await air.read(buf);
    assertEquals(bytesRead, 10);
    assert(decoder.decode(buf).startsWith("hello deno"));

    buf = new Uint8Array(1000);
    bytesRead = await air.read(buf);
    assertEquals(bytesRead, null);
  },
});

test({
  name: "AsyncIterableReader - multiple chunks",
  async fn() {
    const rs = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("hello");
        controller.enqueue("deno");
        controller.close();
      },
    });

    const air = new AsyncIterableReader(rs, encoder.encode);

    let buf = new Uint8Array(1000);
    let bytesRead = await air.read(buf);
    assertEquals(bytesRead, 5);
    assert(decoder.decode(buf).startsWith("hello"));

    buf = new Uint8Array(1000);
    bytesRead = await air.read(buf);
    assertEquals(bytesRead, 4);
    assert(decoder.decode(buf).startsWith("deno"));

    buf = new Uint8Array(1000);
    bytesRead = await air.read(buf);
    assertEquals(bytesRead, null);
  },
});

test({
  name: "AsyncIterableReader - overflow",
  async fn() {
    const rs = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("hello deno");
        controller.close();
      },
    });

    const air = new AsyncIterableReader(rs, encoder.encode);

    let buf = new Uint8Array(5);
    let bytesRead = await air.read(buf);
    assertEquals(bytesRead, 5);
    assert(decoder.decode(buf).startsWith("hello"));

    buf = new Uint8Array(5);
    bytesRead = await air.read(buf);
    assertEquals(bytesRead, 5);
    assert(decoder.decode(buf).startsWith(" deno"));

    buf = new Uint8Array(5);
    bytesRead = await air.read(buf);
    assertEquals(bytesRead, null);
  },
});
