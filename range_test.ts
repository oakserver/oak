// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, assertThrows } from "./test_deps.ts";

import { concat, copyBytes, errors } from "./deps.ts";
import { calculate } from "./etag.ts";
import { ifRange, MultiPartStream, parseRange } from "./range.ts";

const { test } = Deno;

class MockFile implements Deno.Seeker, Deno.Reader, Deno.Closer {
  #buf: Uint8Array;
  #closed = false;
  #offset = 0;

  get closed() {
    return this.#closed;
  }

  constructor(buf: Uint8Array) {
    this.#buf = buf;
  }

  close() {
    this.#closed = true;
  }

  read(p: Uint8Array): Promise<number | null> {
    if (this.#offset >= this.#buf.length) {
      return Promise.resolve(null);
    }
    const nread = Math.min(p.length, 16_384, this.#buf.length - this.#offset);
    if (nread === 0) {
      return Promise.resolve(0);
    }
    copyBytes(this.#buf.subarray(this.#offset, this.#offset + nread), p);
    this.#offset += nread;
    return Promise.resolve(nread);
  }

  seek(offset: number, whence: Deno.SeekMode): Promise<number> {
    assert(whence === Deno.SeekMode.Start);
    if (offset >= this.#buf.length) {
      return Promise.reject(new RangeError("seeked pass end"));
    }
    this.#offset = offset;
    return Promise.resolve(this.#offset);
  }
}

test({
  name: "ifRange() - timestamp - true",
  async fn() {
    assert(
      await ifRange("Wed, 21 Oct 2015 07:28:00 GMT", 1445412480000, {
        size: 1024,
        mtime: new Date(1445412480000),
      }),
    );
  },
});

test({
  name: "ifRange() - timestamp - false",
  async fn() {
    assert(
      !await ifRange("Wed, 21 Oct 2014 07:28:00 GMT", 1445412480000, {
        size: 1024,
        mtime: new Date(1445412480000),
      }),
    );
  },
});

test({
  name: "ifRange() - etag - true",
  async fn() {
    const content = new TextEncoder().encode("hello deno");
    assert(
      await ifRange(`"a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`, 1445412480000, content),
    );
  },
});

test({
  name: "ifRange() - etag - false",
  async fn() {
    const content = new TextEncoder().encode("hello deno");
    assert(!await ifRange(`"blah"`, 1445412480000, content));
  },
});

test({
  name: "ifRange() - weak etag - true",
  async fn() {
    const etag = await calculate({
      size: 1024,
      mtime: new Date(1445412480000),
    });
    assert(
      await ifRange(etag, 1445412480000, {
        size: 1024,
        mtime: new Date(1445412480000),
      }),
    );
  },
});

test({
  name: "parseRange",
  fn() {
    assertEquals(parseRange(`bytes=0-199`, 400), [{ start: 0, end: 199 }]);
    assertEquals(parseRange(`bytes=49-249`, 400), [{ start: 49, end: 249 }]);
    assertEquals(parseRange(`bytes=0-`, 400), [{ start: 0, end: 399 }]);
    assertEquals(parseRange(`bytes=-200`, 400), [{ start: 199, end: 399 }]);
    assertEquals(parseRange(`bytes=0-199, 200-`, 400), [
      { start: 0, end: 199 },
      { start: 200, end: 399 },
    ]);
    assertEquals(parseRange(`bytes=199-`, 200), [{ start: 199, end: 199 }]);
  },
});

test({
  name: "parseRange - errors",
  fn() {
    assertThrows(() => {
      parseRange(`special=0-199`, 400);
    }, errors["RequestedRangeNotSatisfiable"]);
    assertThrows(() => {
      parseRange(`special=0-499`, 400);
    }, errors["RequestedRangeNotSatisfiable"]);
    assertThrows(() => {
      parseRange(`special=200-0`, 400);
    }, errors["RequestedRangeNotSatisfiable"]);
    assertThrows(() => {
      parseRange(`special=400-`, 400);
    }, errors["RequestedRangeNotSatisfiable"]);
  },
});

test({
  name: "MultiPartStream - Uint8Array",
  async fn() {
    const encoder = new TextEncoder();
    const fixture = encoder.encode("hello deno");
    const stream = new MultiPartStream(
      fixture,
      "txt",
      [{ start: 0, end: 5 }, { start: 6, end: 9 }],
      10,
      "test_boundary",
    );
    const contentLength = stream.contentLength();
    const parts = [];
    for await (const part of stream) {
      parts.push(part);
    }
    const decoder = new TextDecoder();
    const actual = decoder.decode(concat(...parts));
    assertEquals(
      actual,
      "\n--test_boundary\nContent-Type: text/plain; charset=UTF-8\nContent-Range: 0-5/10\n\nhello \n--test_boundary\nContent-Type: text/plain; charset=UTF-8\nContent-Range: 6-9/10\n\ndeno\n--test_boundary--\n",
    );
    assertEquals(actual.length, contentLength);
  },
});

test({
  name: "MultiPartStream - File",
  async fn() {
    const encoder = new TextEncoder();
    const fixture = new MockFile(encoder.encode("hello deno"));
    const stream = new MultiPartStream(
      fixture,
      "txt",
      [{ start: 0, end: 5 }, { start: 6, end: 9 }],
      10,
      "test_boundary",
    );
    const contentLength = stream.contentLength();
    const parts = [];
    for await (const part of stream) {
      parts.push(part);
    }
    const decoder = new TextDecoder();
    const actual = decoder.decode(concat(...parts));
    assertEquals(
      actual,
      "\n--test_boundary\nContent-Type: text/plain; charset=UTF-8\nContent-Range: 0-5/10\n\nhello \n--test_boundary\nContent-Type: text/plain; charset=UTF-8\nContent-Range: 6-9/10\n\ndeno\n--test_boundary--\n",
    );
    assertEquals(actual.length, contentLength);
    assert(fixture.closed === true);
  },
});
