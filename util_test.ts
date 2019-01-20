// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { assert, test } from "https://deno.land/x/std/testing/mod.ts";
import * as deno from "deno";
import httpErrors from "./httpError.ts";
import { decodeComponent, resolvePath } from "./util.ts";

test(function testDecodeComponent() {
  // with decodeURIComponent, this would throw:
  assert.equal(decodeComponent("%"), "%");
});

test(function testResolvePath() {
  assert.equal(resolvePath("./foo/bar"), `${deno.cwd()}/foo/bar`);
});

test(function testResolvePathOutsideOfRoot() {
  assert.throws(() => {
    resolvePath("../foo/bar");
  }, httpErrors.Forbidden);
});

test(function testResolvePathOutsideOfRootDevious() {
  assert.throws(() => {
    resolvePath("foo/../../bar");
  }, httpErrors.Forbidden);
});

test(function testResolvePathAbsolute() {
  assert.throws(
    () => {
      resolvePath("/dev/null");
    },
    httpErrors.BadRequest,
    "Malicious Path"
  );
});

test(function testResolvePathContainsNull() {
  assert.throws(
    () => {
      resolvePath("./foo/bar\0baz");
    },
    httpErrors.BadRequest,
    "Malicious Path"
  );
});

test(function testResolvePathRoot() {
  assert.equal(resolvePath("/public", "./foo/bar"), "/public/foo/bar");
});
