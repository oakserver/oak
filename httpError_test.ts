// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assert, assertEquals } from "./test_deps.ts";

import httpError, { createHttpError } from "./httpError.ts";

test(function createHttpErrorTest() {
  const err = createHttpError(501);
  assert(err instanceof httpError.NotImplemented);
  assertEquals(err.status, 501);
  assertEquals(err.name, "NotImplementedError");
  assertEquals(err.message, "Not Implemented");
});

test(function notImplemented() {
  const err = new httpError.NotImplemented();
  assertEquals(err.status, 501);
  assertEquals(err.name, "NotImplementedError");
  assertEquals(err.message, "Not Implemented");
});
