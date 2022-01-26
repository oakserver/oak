// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { getQuery } from "./helpers.ts";
import { assertEquals } from "./test_deps.ts";
import { createMockContext } from "./testing.ts";

const { test } = Deno;

test({
  name: "getQuery - basic",
  fn() {
    const ctx = createMockContext({ path: "/?foo=bar&bar=baz" });
    assertEquals(getQuery(ctx), { foo: "bar", bar: "baz" });
  },
});

test({
  name: "getQuery - asMap",
  fn() {
    const ctx = createMockContext({ path: "/?foo=bar&bar=baz" });
    assertEquals(
      Array.from(getQuery(ctx, { asMap: true })),
      [["foo", "bar"], ["bar", "baz"]],
    );
  },
});

test({
  name: "getQuery - merge params",
  fn() {
    const ctx = createMockContext(
      { params: { foo: "qat", baz: "qat" }, path: "/?foo=bar&bar=baz" },
    );
    assertEquals(
      getQuery(ctx, { mergeParams: true }),
      { foo: "bar", baz: "qat", bar: "baz" },
    );
  },
});
