// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { test, assert } from "https://deno.land/x/std/testing/mod.ts";
import { preferredMediaTypes } from "./mediaType.ts";

test(function testAcceptUndefined() {
  assert.equal(preferredMediaTypes(), ["*/*"]);
});

test(function testAcceptStarStar() {
  assert.equal(preferredMediaTypes("*/*"), ["*/*"]);
});

test(function testAcceptMediaType() {
  assert.equal(preferredMediaTypes("application/json"), ["application/json"]);
});

test(function testAcceptMediaTypeQ0() {
  assert.equal(preferredMediaTypes("application/json;q=0"), []);
});

test(function testAcceptMediaTypeLowQ() {
  assert.equal(preferredMediaTypes("application/json;q=0.2, text/html"), [
    "text/html",
    "application/json"
  ]);
});

test(function testAcceptTextStar() {
  assert.equal(preferredMediaTypes("text/*"), ["text/*"]);
});

test(function testAcceptComplexQ() {
  assert.equal(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1"
    ),
    ["text/plain", "text/html", "application/json", "*/*"]
  );
});

test(function testAcceptSuperLong() {
  assert.equal(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, text/xml, text/yaml, text/javascript, text/csv, text/css, text/rtf, text/markdown, application/octet-stream;q=0.2, */*;q=0.1"
    ),
    [
      "text/plain",
      "text/html",
      "text/xml",
      "text/yaml",
      "text/javascript",
      "text/csv",
      "text/css",
      "text/rtf",
      "text/markdown",
      "application/json",
      "application/octet-stream",
      "*/*"
    ]
  );
});

test(function testProvidedAcceptUndefined() {
  assert.equal(preferredMediaTypes(undefined, ["text/html"]), ["text/html"]);
  assert.equal(
    preferredMediaTypes(undefined, ["text/html", "application/json"]),
    ["text/html", "application/json"]
  );
  assert.equal(
    preferredMediaTypes(undefined, ["application/json", "text/html"]),
    ["application/json", "text/html"]
  );
});

test(function testProvidedAcceptStarStar() {
  assert.equal(preferredMediaTypes("*/*", ["text/html"]), ["text/html"]);
  assert.equal(preferredMediaTypes("*/*", ["text/html", "application/json"]), [
    "text/html",
    "application/json"
  ]);
  assert.equal(preferredMediaTypes("*/*", ["application/json", "text/html"]), [
    "application/json",
    "text/html"
  ]);
});

test(function testCaseInsensitive() {
  assert.equal(preferredMediaTypes("application/json", ["application/JSON"]), [
    "application/JSON"
  ]);
});

test(function testOnlyReturnsValue() {
  assert.equal(preferredMediaTypes("application/json", ["text/html"]), []);
  assert.equal(
    preferredMediaTypes("application/json", ["text/html", "application/json"]),
    ["application/json"]
  );
});

test(function testProvidedButQ0() {
  assert.equal(
    preferredMediaTypes("application/json;q=0", ["application/json"]),
    []
  );
});

test(function testProvidedAcceptsLowQ() {
  assert.equal(
    preferredMediaTypes("application/json;q=0.2, text/html", [
      "application/json"
    ]),
    ["application/json"]
  );
  assert.equal(
    preferredMediaTypes("application/json;q=0.2, text/html", [
      "application/json",
      "text/html"
    ]),
    ["text/html", "application/json"]
  );
  assert.equal(
    preferredMediaTypes("application/json;q=0.2, text/html", [
      "text/html",
      "application/json"
    ]),
    ["text/html", "application/json"]
  );
});

test(function testTextStar() {
  assert.equal(preferredMediaTypes("text/*", ["application/json"]), []);
  assert.equal(
    preferredMediaTypes("text/*", ["application/json", "text/html"]),
    ["text/html"]
  );
  assert.equal(
    preferredMediaTypes("text/*", ["text/html", "application/json"]),
    ["text/html"]
  );
});

test(function testProvidedPreferredOrder() {
  assert.equal(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
      ["application/json", "text/plain", "text/html"]
    ),
    ["text/plain", "text/html", "application/json"]
  );
  assert.equal(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
      ["image/jpeg", "text/html"]
    ),
    ["text/html", "image/jpeg"]
  );
  assert.equal(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
      ["image/jpeg", "image/gif"]
    ),
    ["image/jpeg", "image/gif"]
  );
});

test(function testClientPreferredOrder() {
  assert.equal(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, text/xml, text/yaml, text/javascript, text/csv, text/css, text/rtf, text/markdown, application/octet-stream;q=0.2, */*;q=0.1",
      [
        "text/plain",
        "text/html",
        "text/xml",
        "text/yaml",
        "text/javascript",
        "text/csv",
        "text/css",
        "text/rtf",
        "text/markdown",
        "application/json",
        "application/octet-stream"
      ]
    ),
    [
      "text/plain",
      "text/html",
      "text/xml",
      "text/yaml",
      "text/javascript",
      "text/csv",
      "text/css",
      "text/rtf",
      "text/markdown",
      "application/json",
      "application/octet-stream"
    ]
  );
});
