// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { test, assertEquals } from "./test_deps.ts";
import { preferredMediaTypes } from "./mediaType.ts";

test("testAcceptUndefined", function () {
  assertEquals(preferredMediaTypes(), ["*/*"]);
});

test("testAcceptStarStar", function () {
  assertEquals(preferredMediaTypes("*/*"), ["*/*"]);
});

test("testAcceptMediaType", function () {
  assertEquals(preferredMediaTypes("application/json"), ["application/json"]);
});

test("testAcceptMediaTypeQ0", function () {
  assertEquals(preferredMediaTypes("application/json;q=0"), []);
});

test("testAcceptMediaTypeLowQ", function () {
  assertEquals(preferredMediaTypes("application/json;q=0.2, text/html"), [
    "text/html",
    "application/json",
  ]);
});

test("testAcceptTextStar", function () {
  assertEquals(preferredMediaTypes("text/*"), ["text/*"]);
});

test("testAcceptComplexQ", function () {
  assertEquals(
    preferredMediaTypes(
      "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
    ),
    ["text/plain", "text/html", "application/json", "*/*"],
  );
});

test("testAcceptSuperLong", function () {
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

test("testProvidedAcceptUndefined", function () {
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

test("testProvidedAcceptStarStar", function () {
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

test("testCaseInsensitive", function () {
  assertEquals(preferredMediaTypes("application/json", ["application/JSON"]), [
    "application/JSON",
  ]);
});

test("testOnlyReturnsValue", function () {
  assertEquals(preferredMediaTypes("application/json", ["text/html"]), []);
  assertEquals(
    preferredMediaTypes("application/json", ["text/html", "application/json"]),
    ["application/json"],
  );
});

test("testProvidedButQ0", function () {
  assertEquals(
    preferredMediaTypes("application/json;q=0", ["application/json"]),
    [],
  );
});

test("testProvidedAcceptsLowQ", function () {
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

test("testTextStar", function () {
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

test("testProvidedPreferredOrder", function () {
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

test("testClientPreferredOrder", function () {
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
