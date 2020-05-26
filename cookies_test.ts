// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assertEquals } from "./test_deps.ts";

import { Cookies } from "./cookies.ts";
import { KeyStack } from "./keyStack.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

function createMockRequest(cookieValue?: string[]): Request {
  return {
    headers: new Headers(
      cookieValue ? [["Cookie", cookieValue.join("; ")]] : undefined,
    ),
  } as any;
}

function createMockResponse(): Response {
  return {
    headers: new Headers(),
  } as any;
}

test({
  name: "get cookie value",
  fn() {
    const request = createMockRequest(["foo=bar"]);
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    assertEquals(cookies.get("foo"), "bar");
    assertEquals(cookies.get("bar"), undefined);
    assertEquals([...response.headers], []);
  },
});

test({
  name: "get signed cookie",
  fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    assertEquals(cookies.get("bar"), "foo");
    assertEquals([...response.headers], []);
  },
});

test({
  name: "get signed cookie requiring re-signing",
  fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret2", "secret1"]) },
    );
    assertEquals(cookies.get("bar"), "foo");
    assertEquals([...response.headers], [[
      "set-cookie",
      "bar.sig=ar46bgP3n0ZRazFOfiZ4SyZVFxKUvG1-zQZCb9lbcPI; path=/; httponly",
    ]]);
  },
});

test({
  name: "get invalid signed cookie",
  fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=tampered", "foo=baz"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    assertEquals(cookies.get("bar"), undefined);
    assertEquals(cookies.get("foo"), undefined);
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
  fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    cookies.set("foo", "bar");
    assertEquals([...response.headers], [
      ["set-cookie", "foo=bar; path=/; httponly"],
    ]);
  },
});

test({
  name: "set cookie with options",
  fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(request, response);
    cookies.set("foo", "bar", {
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
  fn() {
    const request = createMockRequest();
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    cookies.set("bar", "foo");

    assertEquals(
      response.headers.get("set-cookie"),
      "bar=foo; path=/; httponly, bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro; path=/; httponly",
    );
  },
});

test({
  name: "iterate cookies",
  fn() {
    const request = createMockRequest(
      ["bar=foo", "foo=baz", "baz=1234"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
    );
    assertEquals(
      [...cookies],
      [["bar", "foo"], ["foo", "baz"], ["baz", "1234"]],
    );
  },
});

test({
  name: "iterate signed cookie",
  fn() {
    const request = createMockRequest(
      ["bar=foo", "bar.sig=S7GhXzJF3n4j8JwTupr7H-h25qtt_vs0stdETXZb-Ro"],
    );
    const response = createMockResponse();
    const cookies = new Cookies(
      request,
      response,
      { keys: new KeyStack(["secret1"]) },
    );
    assertEquals([...cookies], [["bar", "foo"]]);
  },
});
