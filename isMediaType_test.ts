// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { test, assert, assertEquals, assertStrictEq } from "./test_deps.ts";
import { isMediaType } from "./isMediaType.ts";

test(function shouldIgnoreParams() {
  const actual = isMediaType("text/html; charset=utf-8", ["text/*"]);
  assertEquals(actual, "text/html");
});

test(function shouldIgnoreParamsLWS() {
  const actual = isMediaType("text/html ; charset=utf-8", ["text/*"]);
  assertEquals(actual, "text/html");
});

test(function shouldIgnoreCasing() {
  const actual = isMediaType("text/HTML", ["text/*"]);
  assertEquals(actual, "text/html");
});

test(function shouldFailWithInvalidType() {
  const actual = isMediaType("text/html**", ["text/*"]);
  assertEquals(actual, false);
});

test(function returnsFalseWithInvalidTypes() {
  assertEquals(isMediaType("text/html", ["text/html/"]), false);
});

test(function noTypesGiven() {
  assertEquals(isMediaType("image/png", []), "image/png");
});

test(function typeOrFalse() {
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
});

test(function firstTypeOrFalse() {
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

  assertStrictEq(isMediaType("image/png", ["jpeg"]), false);
  assertStrictEq(isMediaType("image/png", [".jpeg"]), false);
  assertStrictEq(isMediaType("image/png", ["text/*", "application/*"]), false);
  assertStrictEq(
    isMediaType("image/png", ["text/html", "text/plain", "application/json"]),
    false,
  );
});

test(function matchSuffix() {
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
  assertStrictEq(
    isMediaType("application/vnd+json", ["application/json"]),
    false,
  );
  assertStrictEq(isMediaType("application/vnd+json", ["text/*+json"]), false);
});

test(function starStarMatchesContentType() {
  assertEquals(isMediaType("text/html", ["*/*"]), "text/html");
  assertEquals(isMediaType("text/xml", ["*/*"]), "text/xml");
  assertEquals(isMediaType("application/json", ["*/*"]), "application/json");
  assertEquals(
    isMediaType("application/vnd+json", ["*/*"]),
    "application/vnd+json",
  );
});

test(function starStarInvalidMTReturnsFalse() {
  assertStrictEq(isMediaType("bogus", ["*/*"]), false);
});

test(function matchUrlEncoded() {
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
});

test(function matchMultipartStar() {
  assertEquals(
    isMediaType("multipart/form-data", ["multipart/*"]),
    "multipart/form-data",
  );
});

test(function matchMultipart() {
  assertEquals(isMediaType("multipart/form-data", ["multipart"]), "multipart");
});
