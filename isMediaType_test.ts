// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assertEquals, assertStrictEquals } from "./test_deps.ts";
import { isMediaType } from "./isMediaType.ts";

test({
  name: "isMediaType should ignore params",
  fn() {
    const actual = isMediaType("text/html; charset=utf-8", ["text/*"]);
    assertEquals(actual, "text/html");
  },
});

test({
  name: "isMediaType should ignore params LWS",
  fn() {
    const actual = isMediaType("text/html ; charset=utf-8", ["text/*"]);
    assertEquals(actual, "text/html");
  },
});

test({
  name: "isMediaType should ignore casing",
  fn() {
    const actual = isMediaType("text/HTML", ["text/*"]);
    assertEquals(actual, "text/html");
  },
});

test({
  name: "isMediaType should fail with invalid type",
  fn() {
    const actual = isMediaType("text/html**", ["text/*"]);
    assertEquals(actual, false);
  },
});

test({
  name: "isMediaType returns false with invalid types",
  fn() {
    assertEquals(isMediaType("text/html", ["text/html/"]), false);
  },
});

test({
  name: "isMediaType no types given",
  fn() {
    assertEquals(isMediaType("image/png", []), "image/png");
  },
});

test({
  name: "isMediaType type or false",
  fn() {
    assertEquals(isMediaType("image/png", ["png"]), "png");
    assertEquals(isMediaType("image/png", [".png"]), ".png");
    assertEquals(isMediaType("image/png", ["image/png"]), "image/png");
    assertEquals(isMediaType("image/png", ["image/*"]), "image/png");
    assertEquals(isMediaType("image/png", ["*/png"]), "image/png");

    assertEquals(isMediaType("image/png", ["jpeg"]), false);
    assertEquals(isMediaType("image/png", [".jpeg"]), false);
    assertEquals(isMediaType("image/png", ["image/jpeg"]), false);
    assertEquals(isMediaType("image/png", ["text/*"]), false);
    assertEquals(isMediaType("image/png", ["*/jpeg"]), false);

    assertEquals(isMediaType("image/png", ["bogus"]), false);
    assertEquals(isMediaType("image/png", ["something/bogus*"]), false);
  },
});

test({
  name: "isMediaType first type or false",
  fn() {
    assertEquals(isMediaType("image/png", ["png"]), "png");
    assertEquals(isMediaType("image/png", [".png"]), ".png");
    assertEquals(isMediaType("image/png", ["text/*", "image/*"]), "image/png");
    assertEquals(isMediaType("image/png", ["image/*", "text/*"]), "image/png");
    assertEquals(
      isMediaType("image/png", ["image/*", "image/png"]),
      "image/png",
    );
    assertEquals(
      isMediaType("image/png", ["image/png", "image/*"]),
      "image/png",
    );

    assertStrictEquals(isMediaType("image/png", ["jpeg"]), false);
    assertStrictEquals(isMediaType("image/png", [".jpeg"]), false);
    assertStrictEquals(
      isMediaType("image/png", ["text/*", "application/*"]),
      false,
    );
    assertStrictEquals(
      isMediaType("image/png", ["text/html", "text/plain", "application/json"]),
      false,
    );
  },
});

test({
  name: "isMediaType match suffix",
  fn() {
    assertEquals(
      isMediaType("application/vnd+json", ["+json"]),
      "application/vnd+json",
    );
    assertEquals(
      isMediaType("application/vnd+json", ["application/vnd+json"]),
      "application/vnd+json",
    );
    assertEquals(
      isMediaType("application/vnd+json", ["application/*+json"]),
      "application/vnd+json",
    );
    assertEquals(
      isMediaType("application/vnd+json", ["*/vnd+json"]),
      "application/vnd+json",
    );
    assertStrictEquals(
      isMediaType("application/vnd+json", ["application/json"]),
      false,
    );
    assertStrictEquals(
      isMediaType("application/vnd+json", ["text/*+json"]),
      false,
    );
  },
});

test({
  name: "isMediaType start matches content type",
  fn() {
    assertEquals(isMediaType("text/html", ["*/*"]), "text/html");
    assertEquals(isMediaType("text/xml", ["*/*"]), "text/xml");
    assertEquals(isMediaType("application/json", ["*/*"]), "application/json");
    assertEquals(
      isMediaType("application/vnd+json", ["*/*"]),
      "application/vnd+json",
    );
  },
});

test({
  name: "isMediaType start with invalid media type returns false",
  fn() {
    assertStrictEquals(isMediaType("bogus", ["*/*"]), false);
  },
});

test({
  name: "isMediaType matching url encoded",
  fn() { //matchUrlEncoded() {
    assertEquals(
      isMediaType("application/x-www-form-urlencoded", ["urlencoded"]),
      "urlencoded",
    );
    assertEquals(
      isMediaType("application/x-www-form-urlencoded", ["json", "urlencoded"]),
      "urlencoded",
    );
    assertEquals(
      isMediaType("application/x-www-form-urlencoded", ["urlencoded", "json"]),
      "urlencoded",
    );
  },
});

test({
  name: "isMediaType matching multipart star",
  fn() { //matchMultipartStar() {
    assertEquals(
      isMediaType("multipart/form-data", ["multipart/*"]),
      "multipart/form-data",
    );
  },
});

test({
  name: "isMediaType matching multipart",
  fn() { //matchMultipart() {
    assertEquals(
      isMediaType("multipart/form-data", ["multipart"]),
      "multipart",
    );
  },
});
