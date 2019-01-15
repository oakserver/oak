import {
  test,
  assert,
  assertEqual
} from "https://deno.land/x/std/testing/mod.ts";

import httpError, { createHttpError } from "./httpError.ts";

test(function createHttpErrorTest() {
  const err = createHttpError(501);
  assert(err instanceof httpError.NotImplemented);
  assertEqual(err.status, 501);
  assertEqual(err.name, "NotImplementedError");
  assertEqual(err.message, "Not Implemented");
});

test(function notImplemented() {
  const err = new httpError.NotImplemented();
  assertEqual(err.status, 501);
  assertEqual(err.name, "NotImplementedError");
  assertEqual(err.message, "Not Implemented");
});
