// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { test, assert } from "https://deno.land/x/std/testing/mod.ts";
import { isMediaType } from "./isMediaType.ts";

test(function shouldIgnoreParams() {
  const actual = isMediaType("text/html; charset=utf-8", ["text/*"]);
  assert.equal(actual, "text/html");
});

test(function shouldIgnoreParamsLWS() {
  const actual = isMediaType("text/html ; charset=utf-8", ["text/*"]);
  assert.equal(actual, "text/html");
});

test(function shouldIgnoreCasing() {
  const actual = isMediaType("text/HTML", ["text/*"]);
  assert.equal(actual, "text/html");
});

test(function shouldFailWithInvalidType() {
  const actual = isMediaType("text/html**", ["text/*"]);
  assert.equal(actual, false);
});

test(function returnsFalseWithInvalidTypes() {
  assert.equal(isMediaType("text/html", ["text/html/"]), false);
});

test(function noTypesGiven() {
  assert.equal(isMediaType("image/png", []), "image/png");
});

test(function typeOrFalse() {
  assert.equal(isMediaType("image/png", ["png"]), "png");
  assert.equal(isMediaType("image/png", [".png"]), ".png");
  assert.equal(isMediaType("image/png", ["image/png"]), "image/png");
  assert.equal(isMediaType("image/png", ["image/*"]), "image/png");
  assert.equal(isMediaType("image/png", ["*/png"]), "image/png");

  assert.equal(isMediaType("image/png", ["jpeg"]), false);
  assert.equal(isMediaType("image/png", [".jpeg"]), false);
  assert.equal(isMediaType("image/png", ["image/jpeg"]), false);
  assert.equal(isMediaType("image/png", ["text/*"]), false);
  assert.equal(isMediaType("image/png", ["*/jpeg"]), false);

  assert.equal(isMediaType("image/png", ["bogus"]), false);
  assert.equal(isMediaType("image/png", ["something/bogus*"]), false);
});

test(function firstTypeOrFalse() {
  assert.equal(isMediaType("image/png", ["png"]), "png");
  assert.equal(isMediaType("image/png", [".png"]), ".png");
  assert.equal(isMediaType("image/png", ["text/*", "image/*"]), "image/png");
  assert.equal(isMediaType("image/png", ["image/*", "text/*"]), "image/png");
  assert.equal(isMediaType("image/png", ["image/*", "image/png"]), "image/png");
  assert.equal(isMediaType("image/png", ["image/png", "image/*"]), "image/png");

  assert.strictEqual(isMediaType("image/png", ["jpeg"]), false);
  assert.strictEqual(isMediaType("image/png", [".jpeg"]), false);
  assert.strictEqual(
    isMediaType("image/png", ["text/*", "application/*"]),
    false
  );
  assert.strictEqual(
    isMediaType("image/png", ["text/html", "text/plain", "application/json"]),
    false
  );
});

test(function matchSuffix() {
  assert.equal(
    isMediaType("application/vnd+json", ["+json"]),
    "application/vnd+json"
  );
  assert.equal(
    isMediaType("application/vnd+json", ["application/vnd+json"]),
    "application/vnd+json"
  );
  assert.equal(
    isMediaType("application/vnd+json", ["application/*+json"]),
    "application/vnd+json"
  );
  assert.equal(
    isMediaType("application/vnd+json", ["*/vnd+json"]),
    "application/vnd+json"
  );
  assert.strictEqual(
    isMediaType("application/vnd+json", ["application/json"]),
    false
  );
  assert.strictEqual(
    isMediaType("application/vnd+json", ["text/*+json"]),
    false
  );
});

test(function starStarMatchesContentType() {
  assert.equal(isMediaType("text/html", ["*/*"]), "text/html");
  assert.equal(isMediaType("text/xml", ["*/*"]), "text/xml");
  assert.equal(isMediaType("application/json", ["*/*"]), "application/json");
  assert.equal(
    isMediaType("application/vnd+json", ["*/*"]),
    "application/vnd+json"
  );
});

test(function starStarInvalidMTReturnsFalse() {
  assert.strictEqual(isMediaType("bogus", ["*/*"]), false);
});

test(function matchUrlEncoded() {
  assert.equal(
    isMediaType("application/x-www-form-urlencoded", ["urlencoded"]),
    "urlencoded"
  );
  assert.equal(
    isMediaType("application/x-www-form-urlencoded", ["json", "urlencoded"]),
    "urlencoded"
  );
  assert.equal(
    isMediaType("application/x-www-form-urlencoded", ["urlencoded", "json"]),
    "urlencoded"
  );
});

test(function matchMultipartStar() {
  assert.equal(
    isMediaType("multipart/form-data", ["multipart/*"]),
    "multipart/form-data"
  );
});

test(function matchMultipart() {
  assert.equal(isMediaType("multipart/form-data", ["multipart"]), "multipart");
});
