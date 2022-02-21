// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import { assertEquals, assertRejects } from "./test_deps.ts";

import { Cookies } from "./cookies.ts";
import { KeyStack } from "./keyStack.ts";
import type { Request } from "./request.ts";
import type { Response } from "./response.ts";
import { isNode } from "./util.ts";

const { test } = Deno;

function createMockRequest(cookieValue?: string[], secure = false): Request {
  return {
    headers: new Headers(
      cookieValue ? [["Cookie", cookieValue.join("; ")]] : undefined,
    ),
    secure,
  } as any;
}

function createMockResponse(): Response {
  return {
    headers: new Headers(),
  } as any;
}

test({
  name: "get cookie value",
  async fn() {
    const request = createMockRequest(["foo=bar"]);
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    assertEquals(await cookies.get("foo"), "bar");
    assertEquals(await cookies.get("bar"), undefined);
    assertEquals([...response.headers], []);
  },
});

test({
  name: "get signed cookie",
  async fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    assertEquals(await cookies.get("bar"), "foo");
    assertEquals([...response.headers], []);
  },
});

test({
  name: "get signed cookie requiring re-signing",
  async fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret2", "secret1"]) },
    );
    assertEquals(await cookies.get("bar"), "foo");
    assertEquals([...response.headers], [[
      "set-cookie",
      "bar.sig=ar46bgP3n0ZRazFOfiZ4SyZVFxKUvG1-zQZCb9lbcPI; path=/; httponly",
    ]]);
  },
});

test({
  name: "get invalid signed cookie",
  async fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=tampered", "foo=baz"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    assertEquals(await cookies.get("bar"), undefined);
    assertEquals(await cookies.get("foo"), undefined);
    assertEquals([...response.headers], [
      [
        "set-cookie",
        "bar.sig=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
      ],
    ]);
  },
});

test({
  name: "set cookie",
  async fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    await cookies.set("foo", "bar");
    assertEquals([...response.headers], [
      ["set-cookie", "foo=bar; path=/; httponly"],
    ]);
  },
});

test({
  name: "set multiple cookies",
  async fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    await cookies.set("a", "a");
    await cookies.set("b", "b");
    await cookies.set("c", "c");
    const expected = isNode()
      ? [[
        "set-cookie",
        "a=a; path=/; httponly, b=b; path=/; httponly, c=c; path=/; httponly",
      ]]
      : [
        ["set-cookie", "a=a; path=/; httponly"],
        ["set-cookie", "b=b; path=/; httponly"],
        ["set-cookie", "c=c; path=/; httponly"],
      ];
    assertEquals([...response.headers], expected);
  },
});

test({
  name: "set cookie with options",
  async fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    await cookies.set("foo", "bar", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: false,
      path: "/foo",
      sameSite: "strict",
    });
    assertEquals(
      response.headers.get("set-cookie"),
      "foo=bar; path=/foo; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict",
    );
  },
});

test({
  name: "set signed cookie",
  async fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    await cookies.set("bar", "foo");

    assertEquals(
      response.headers.get("set-cookie"),
      "bar=foo; path=/; httponly, bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro; path=/; httponly",
    );
  },
});

test({
  name: "set secure cookie",
  async fn() {
    const request = createMockRequest([], true);
    const response = createMockResponse();
    const cookies = new Cookies(request, response, { secure: true });
    await cookies.set("bar", "foo", { secure: true });

    assertEquals(
      response.headers.get("set-cookie"),
      "bar=foo; path=/; secure; httponly",
    );
  },
});

test({
  name: "set secure cookie on insecure context fails",
  async fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    await assertRejects(
      async () => {
        await cookies.set("bar", "foo", { secure: true });
      },
      TypeError,
      "Cannot send secure cookie over unencrypted connection.",
    );
  },
});

test({
  name: "set secure cookie on insecure context with ignoreInsecure",
  async fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    await cookies.set("bar", "foo", { secure: true, ignoreInsecure: true });

    assertEquals(
      response.headers.get("set-cookie"),
      "bar=foo; path=/; secure; httponly",
    );
  },
});

test({
  name: "iterate cookies",
  async fn() {
    const request = createMockRequest(
      ["bar=foo", "foo=baz", "baz=1234"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
    );
    const actual = [];
    for await (const cookie of cookies) {
      actual.push(cookie);
    }
    assertEquals(
      actual,
      [["bar", "foo"], ["foo", "baz"], ["baz", "1234"]],
    );
  },
});

test({
  name: "iterate signed cookie",
  async fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    const actual = [];
    for await (const cookie of cookies) {
      actual.push(cookie);
    }
    assertEquals(actual, [["bar", "foo"]]);
  },
});

test({
  name: "Cookies - inspecting",
  fn() {
    const request = createMockRequest(
      ["bar=foo", "foo=baz", "baz=1234"],
    );
    const response = createMockResponse();
    assertEquals(
      Deno.inspect(new Cookies(request, response)),
      `Cookies []`,
    );
  },
});

test({
  name: "set multiple cookies with options",
  async fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    await cookies.set("foo", "bar", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: false,
      path: "/foo",
      sameSite: "strict",
    });
    await cookies.set("a", "b", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: false,
      path: "/a",
      sameSite: "strict",
    });
    await cookies.set("foo", "baz", {
      domain: "*.example.com",
      expires: new Date("2020-01-01T00:00:00+00:00"),
      httpOnly: false,
      overwrite: true,
      path: "/baz",
      sameSite: "strict",
    });
    const expected = isNode()
      ? "foo=baz; path=/baz; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict"
      : "a=b; path=/a; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict, foo=baz; path=/baz; expires=Wed, 01 Jan 2020 00:00:00 GMT; domain=*.example.com; samesite=strict";
    assertEquals(response.headers.get("set-cookie"), expected);
  },
});
