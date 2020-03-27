// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { test, assertEquals } from "./test_deps.ts";
import { preferredMediaTypes } from "./mediaType.ts";

test(function testAcceptUndefined() {
  assertEquals(preferredMediaTypes(), ["*/*"]);
});

test(function testAcceptStarStar() {
  assertEquals(preferredMediaTypes("*/*"), ["*/*"]);
});

test(function testAcceptMediaType() {
  assertEquals(preferredMediaTypes("application/json"), ["application/json"]);
});

test(function testAcceptMediaTypeQ0() {
  assertEquals(preferredMediaTypes("application/json;q=0"), []);
});

test(function testAcceptMediaTypeLowQ() {
  assertEquals(preferredMediaTypes("application/json;q=0.2, text/html"), [
    "text/html",
    "application/json",
  ]);
});

test(function testAcceptTextStar() {
  assertEquals(preferredMediaTypes("text/*"), ["text/*"]);
});

test(function testAcceptComplexQ() {
  assertEquals(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
    ),
    ["text/plain", "text/html", "application/json", "*/*"],
  );
});

test(function testAcceptSuperLong() {
  assertEquals(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, text/xml, text/yaml, text/javascript, text/csv, text/css, text/rtf, text/markdown, application/octet-stream;q=0.2, */*;q=0.1",
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
      "*/*",
    ],
  );
});

test(function testProvidedAcceptUndefined() {
  assertEquals(preferredMediaTypes(undefined, ["text/html"]), ["text/html"]);
  assertEquals(
    preferredMediaTypes(undefined, ["text/html", "application/json"]),
    ["text/html", "application/json"],
  );
  assertEquals(
    preferredMediaTypes(undefined, ["application/json", "text/html"]),
    ["application/json", "text/html"],
  );
});

test(function testProvidedAcceptStarStar() {
  assertEquals(preferredMediaTypes("*/*", ["text/html"]), ["text/html"]);
  assertEquals(preferredMediaTypes("*/*", ["text/html", "application/json"]), [
    "text/html",
    "application/json",
  ]);
  assertEquals(preferredMediaTypes("*/*", ["application/json", "text/html"]), [
    "application/json",
    "text/html",
  ]);
});

test(function testCaseInsensitive() {
  assertEquals(preferredMediaTypes("application/json", ["application/JSON"]), [
    "application/JSON",
  ]);
});

test(function testOnlyReturnsValue() {
  assertEquals(preferredMediaTypes("application/json", ["text/html"]), []);
  assertEquals(
    preferredMediaTypes("application/json", ["text/html", "application/json"]),
    ["application/json"],
  );
});

test(function testProvidedButQ0() {
  assertEquals(
    preferredMediaTypes("application/json;q=0", ["application/json"]),
    [],
  );
});

test(function testProvidedAcceptsLowQ() {
  assertEquals(
    preferredMediaTypes("application/json;q=0.2, text/html", [
      "application/json",
    ]),
    ["application/json"],
  );
  assertEquals(
    preferredMediaTypes("application/json;q=0.2, text/html", [
      "application/json",
      "text/html",
    ]),
    ["text/html", "application/json"],
  );
  assertEquals(
    preferredMediaTypes("application/json;q=0.2, text/html", [
      "text/html",
      "application/json",
    ]),
    ["text/html", "application/json"],
  );
});

test(function testTextStar() {
  assertEquals(preferredMediaTypes("text/*", ["application/json"]), []);
  assertEquals(
    preferredMediaTypes("text/*", ["application/json", "text/html"]),
    ["text/html"],
  );
  assertEquals(
    preferredMediaTypes("text/*", ["text/html", "application/json"]),
    ["text/html"],
  );
});

test(function testProvidedPreferredOrder() {
  assertEquals(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
      ["application/json", "text/plain", "text/html"],
    ),
    ["text/plain", "text/html", "application/json"],
  );
  assertEquals(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
      ["image/jpeg", "text/html"],
    ),
    ["text/html", "image/jpeg"],
  );
  assertEquals(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
      ["image/jpeg", "image/gif"],
    ),
    ["image/jpeg", "image/gif"],
  );
});

test(function testClientPreferredOrder() {
  assertEquals(
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
        "application/octet-stream",
      ],
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
    ],
  );
});
