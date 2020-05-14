// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assertEquals } from "../test_deps.ts";
import { preferredMediaTypes } from "./mediaType.ts";

test({
  name: "preferredMediaTypes accepts undefined",
  fn() {
    assertEquals(preferredMediaTypes(), ["*/*"]);
  },
});

test({
  name: "preferredMediaTypes accepts */*",
  fn() {
    assertEquals(preferredMediaTypes("*/*"), ["*/*"]);
  },
});

test({
  name: "preferredMediaTypes basic",
  fn() {
    assertEquals(preferredMediaTypes("application/json"), ["application/json"]);
  },
});

test({
  name: "preferredMediaTypes with a q=0",
  fn() {
    assertEquals(preferredMediaTypes("application/json;q=0"), []);
  },
});

test({
  name: "preferredMediaTypes with a low q",
  fn() {
    assertEquals(preferredMediaTypes("application/json;q=0.2, text/html"), [
      "text/html",
      "application/json",
    ]);
  },
});

test({
  name: "preferredMediaTypes with a text/*",
  fn() {
    assertEquals(preferredMediaTypes("text/*"), ["text/*"]);
  },
});

test({
  name: "preferredMediaTypes with a complex q",
  fn() {
    assertEquals(
      preferredMediaTypes(
        "text/plain, application/json;q=0.5, text/html, */*;q=0.1",
      ),
      ["text/plain", "text/html", "application/json", "*/*"],
    );
  },
});

test({
  name: "preferredMediaTypes that is super long",
  fn() {
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
  },
});

test({
  name: "preferredMediaTypes provided is undefined",
  fn() {
    assertEquals(preferredMediaTypes(undefined, ["text/html"]), ["text/html"]);
    assertEquals(
      preferredMediaTypes(undefined, ["text/html", "application/json"]),
      ["text/html", "application/json"],
    );
    assertEquals(
      preferredMediaTypes(undefined, ["application/json", "text/html"]),
      ["application/json", "text/html"],
    );
  },
});

test({
  name: "preferredMediaTypes provides accepts",
  fn() {
    assertEquals(preferredMediaTypes("*/*", ["text/html"]), ["text/html"]);
    assertEquals(
      preferredMediaTypes("*/*", ["text/html", "application/json"]),
      [
        "text/html",
        "application/json",
      ],
    );
    assertEquals(
      preferredMediaTypes("*/*", ["application/json", "text/html"]),
      [
        "application/json",
        "text/html",
      ],
    );
  },
});

test({
  name: "preferredMediaTypes is case insensitive",
  fn() {
    assertEquals(
      preferredMediaTypes("application/json", ["application/JSON"]),
      [
        "application/JSON",
      ],
    );
  },
});

test({
  name: "preferredMediaTypes only returns an accepted value",
  fn() {
    assertEquals(preferredMediaTypes("application/json", ["text/html"]), []);
    assertEquals(
      preferredMediaTypes(
        "application/json",
        ["text/html", "application/json"],
      ),
      ["application/json"],
    );
  },
});

test({
  name: "preferredMediaType provided but with q=0",
  fn() {
    assertEquals(
      preferredMediaTypes("application/json;q=0", ["application/json"]),
      [],
    );
  },
});

test({
  name: "preferredMediaType accepts low q",
  fn() {
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
  },
});

test({
  name: "preferredMediaTypes against text/*",
  fn() {
    assertEquals(preferredMediaTypes("text/*", ["application/json"]), []);
    assertEquals(
      preferredMediaTypes("text/*", ["application/json", "text/html"]),
      ["text/html"],
    );
    assertEquals(
      preferredMediaTypes("text/*", ["text/html", "application/json"]),
      ["text/html"],
    );
  },
});

test({
  name: "preferredMediaTypes provided respects ordering",
  fn() {
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
  },
});

test({
  name: "preferredMediaTypes with complex preferred order",
  fn() {
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
  },
});
