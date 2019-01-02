import { test, assertEqual } from "https://deno.land/x/testing/testing.ts";

import * as httpError from "./httpError.ts";

test(function createHttpErrorTest() {
  const err = httpError.createHttpError(501);
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
