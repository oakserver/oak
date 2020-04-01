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

test(function constructCookieHandler() {
  const cookie = new CookieHandler(createMockRequest(), {});
  assert(cookie instanceof CookieHandler);
});

test(function getCookie() {
  const cookie = new CookieHandler(
    createMockRequest("foo=bar; name=value=value"),
    {},
  );
  assert(cookie.get("foo") === "bar");
  assert(cookie.get("name") === "value=value");
});

test(function setCookie() {
  const response = { headers: new Headers() };
  const cookie = new CookieHandler(createMockRequest(), response);
  cookie.set({
    name: "foo",
    value: "bar",
    httpOnly: true,
  });

  assert(response.headers.get("Set-Cookie") === "foo=bar; HttpOnly");
});

test(function delCookie() {
  const response = { headers: new Headers() };
  const cookie = new CookieHandler(createMockRequest(), response);
  cookie.del("foo");

  assert(
    response.headers.get("Set-Cookie") ===
      "foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  );
});
