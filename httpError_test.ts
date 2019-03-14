// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { test } from "https://deno.land/x/std/testing/mod.ts";
import {
  assertEquals,
  assert
} from "https://deno.land/x/std/testing/asserts.ts";

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
