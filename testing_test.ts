// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, assertStrictEquals } from "./test_deps.ts";

import {
  createMockApp,
  createMockContext,
  createMockNext,
  mockContextState,
} from "./testing.ts";

Deno.test({
  name: "testing - createMockApp()",
  fn() {
    const app = createMockApp();
    assertEquals(app.state, {});
  },
});

Deno.test({
  name: "testing - createMockApp() - with state",
  fn() {
    const app = createMockApp({ a: "a" });
    assertEquals(app.state, { a: "a" });
  },
});

Deno.test({
  name: "testing - createMockContext()",
  fn() {
    const ctx = createMockContext();
    assert(ctx.app);
    assertEquals(ctx.request.method, "GET");
    assertStrictEquals(ctx.params, undefined);
    assertEquals(ctx.request.url.pathname, "/");
    assertEquals(ctx.state, {});
    assertEquals(ctx.request.acceptsEncodings("identity"), "identity");
  },
});

Deno.test({
  name: "testing - mockContextState",
  fn() {
    mockContextState.encodingsAccepted = "gzip";
    const ctx = createMockContext();
    try {
      assertEquals(ctx.request.acceptsEncodings("gzip"), "gzip");
    } finally {
      mockContextState.encodingsAccepted = "identity";
    }
  },
});

Deno.test({
  name: "testing - createMockNext()",
  fn() {
    const next = createMockNext();
    assertStrictEquals(typeof next, "function");
    assert(next() instanceof Promise);
  },
});
