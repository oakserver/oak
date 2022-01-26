// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

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
    ctx.response.redirect("/hello/world");
    assertEquals(ctx.response.headers.get("Location"), "/hello/world");
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
  name: "testing - ctx.cookies.set()",
  async fn() {
    const ctx = createMockContext();
    await ctx.cookies.set(
      "sessionID",
      "S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro",
      { httpOnly: true },
    );
    assertEquals([...ctx.response.headers], [
      [
        "set-cookie",
        "sessionID=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro; path=/; httponly",
      ],
    ]);
  },
});

Deno.test({
  name: "testing - ctx.cookies.get()",
  async fn() {
    const ctx = createMockContext({
      headers: [[
        "cookie",
        "sessionID=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro;",
      ]],
    });
    assertEquals(
      await ctx.cookies.get("sessionID"),
      "S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro",
    );
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
