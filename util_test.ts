// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { assertEquals, assertThrows, test } from "./test_deps.ts";
import httpErrors from "./httpError.ts";
import { decodeComponent, resolvePath } from "./util.ts";

test("testDecodeComponent", function () {
  // with decodeURIComponent, this would throw:
  assertEquals(decodeComponent("%"), "%");
});

test("testResolvePath", function () {
  assertEquals(resolvePath("./foo/bar"), `${Deno.cwd()}/foo/bar`);
});

test("testResolvePathOutsideOfRoot", function () {
  assertThrows(() => {
    resolvePath("../foo/bar");
  }, httpErrors.Forbidden);
});

test("testResolvePathOutsideOfRootDevious", function () {
  assertThrows(() => {
    resolvePath("foo/../../bar");
  }, httpErrors.Forbidden);
});

test("testResolvePathAbsolute", function () {
  assertThrows(
    () => {
      resolvePath("/dev/null");
    },
    httpErrors.BadRequest,
    "Malicious Path",
  );
});

test("testResolvePathContainsNull", function () {
  assertThrows(
    () => {
      resolvePath("./foo/bar\0baz");
    },
    httpErrors.BadRequest,
    "Malicious Path",
  );
});

test("testResolvePathRoot", function () {
  assertEquals(resolvePath("/public", "./foo/bar"), "/public/foo/bar");
});
