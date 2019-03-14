// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import * as deno from "deno";
import { assertEquals, assertThrows } from "https://deno.land/x/std/testing/asserts.ts";
import { test } from "https://deno.land/x/std/testing/mod.ts";
import httpErrors from "./httpError.ts";
import { decodeComponent, resolvePath } from "./util.ts";

test(function testDecodeComponent() {
  // with decodeURIComponent, this would throw:
  assertEquals(decodeComponent("%"), "%");
});

test(function testResolvePath() {
  assertEquals(resolvePath("./foo/bar"), `${deno.cwd()}/foo/bar`);
});

test(function testResolvePathOutsideOfRoot() {
  assertThrows(() => {
    resolvePath("../foo/bar");
  }, httpErrors.Forbidden);
});

test(function testResolvePathOutsideOfRootDevious() {
  assertThrows(() => {
    resolvePath("foo/../../bar");
  }, httpErrors.Forbidden);
});

test(function testResolvePathAbsolute() {
  assertThrows(
    () => {
      resolvePath("/dev/null");
    },
    httpErrors.BadRequest,
    "Malicious Path"
  );
});

test(function testResolvePathContainsNull() {
  assertThrows(
    () => {
      resolvePath("./foo/bar\0baz");
    },
    httpErrors.BadRequest,
    "Malicious Path"
  );
});

test(function testResolvePathRoot() {
  assertEquals(resolvePath("/public", "./foo/bar"), "/public/foo/bar");
});
