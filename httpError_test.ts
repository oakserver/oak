// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { test, assert } from "https://deno.land/x/std/testing/mod.ts";

import httpError, { createHttpError } from "./httpError.ts";

test(function createHttpErrorTest() {
  const err = createHttpError(501);
  assert(err instanceof httpError.NotImplemented);
  assert.equal(err.status, 501);
  assert.equal(err.name, "NotImplementedError");
  assert.equal(err.message, "Not Implemented");
});

test(function notImplemented() {
  const err = new httpError.NotImplemented();
  assert.equal(err.status, 501);
  assert.equal(err.name, "NotImplementedError");
  assert.equal(err.message, "Not Implemented");
});
