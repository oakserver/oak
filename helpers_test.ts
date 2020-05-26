// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Application } from "./application.ts";
import { Context } from "./context.ts";
import { getQuery } from "./helpers.ts";
import { assertEquals } from "./test_deps.ts";

const { test } = Deno;

function createMockApp<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  state = {} as S,
): Application<S> {
  return {
    state,
  } as any;
}

interface MockContextOptions<
  S extends Record<string | number | symbol, any> = Record<string, any>,
> {
  app?: Application<S>;
  method?: string;
  params?: Record<string, string>;
  path?: string;
}

function createMockContext<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  {
    app = createMockApp(),
    method = "GET",
    params,
    path = "/",
  }: MockContextOptions = {},
) {
  const headers = new Headers();
  return ({
    app,
    params,
    request: {
      headers: new Headers(),
      method,
      url: new URL(path, "https://localhost/"),
    },
    response: {
      status: undefined,
      body: undefined,
      redirect(url: string | URL) {
        headers.set("Location", encodeURI(String(url)));
      },
      headers,
    },
    state: app.state,
  } as unknown) as Context<S>;
}

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
