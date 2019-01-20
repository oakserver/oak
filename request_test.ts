// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { test, assert } from "https://deno.land/x/std/testing/mod.ts";
import { ServerRequest } from "./deps.ts";
import { Request } from "./request.ts";

function createMockServerRequest(
  url = "/",
  acceptsEncoding?: string
): ServerRequest {
  const headers = new Headers();
  if (acceptsEncoding) {
    headers.set("Accept-Encoding", acceptsEncoding);
  }
  return {
    headers,
    method: "GET",
    url,
    async respond() {}
  } as any;
}

test(function requestSearch() {
  const request = new Request(createMockServerRequest("/foo?bar=baz&qat=qux"));
  assert.equal(request.path, "/foo");
  assert.equal(request.search, "?bar=baz&qat=qux");
  assert.equal(request.method, "GET");
  assert.equal(Array.from(request.searchParams.entries()), [
    ["bar", "baz"],
    ["qat", "qux"]
  ]);
});

test(function requestAcceptEncoding() {
  const request = new Request(
    createMockServerRequest("/", "gzip, compress;q=0.2, identity;q=0.5")
  );
  assert.equal(request.acceptsEncodings("gzip", "identity"), "gzip");
});
