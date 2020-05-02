import { ServerRequest } from "./deps.ts";
import { test, assert } from "./test_deps.ts";
import CookieHandler from "./cookieHandler.ts";

function createMockRequest(cookie?: string): ServerRequest {
  const headers = new Headers();
  if (cookie) {
    headers.append("Cookie", cookie);
  }
  return {
    url: "https://example.com/",
    headers,
    async respond() {},
  } as any;
}

test({
  name: "new CoockieHandler()",
  fn() {
    const cookie = new CookieHandler(createMockRequest(), {});
    assert(cookie instanceof CookieHandler);
  },
});

test({
  name: "cookie.getCookie()",
  fn() {
    const cookie = new CookieHandler(
      createMockRequest("foo=bar; name=value=value"),
      {},
    );
    assert(cookie.get("foo") === "bar");
    assert(cookie.get("name") === "value=value");
  },
});

test({
  name: "cookie.set()",
  fn() {
    const response = { headers: new Headers() };
    const cookie = new CookieHandler(createMockRequest(), response);
    cookie.set({
      name: "foo",
      value: "bar",
      httpOnly: true,
    });

    assert(response.headers.get("Set-Cookie") === "foo=bar; HttpOnly");
  },
});

test({
  name: "cookie.del()",
  fn() {
    const response = { headers: new Headers() };
    const cookie = new CookieHandler(createMockRequest(), response);
    cookie.del("foo");

    assert(
      response.headers.get("Set-Cookie") ===
        "foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
  },
});
