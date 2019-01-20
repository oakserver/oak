// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { assert, test } from "https://deno.land/x/std/testing/mod.ts";
import * as mod from "./mod.ts";

test(function publicApi() {
  assert(mod != null);
  assert.equal(typeof mod.Application, "function");
  assert.equal(typeof mod.Context, "function");
  assert.equal(typeof mod.HttpError, "function");
  assert.equal(typeof mod.Router, "function");
  assert.equal(typeof mod.STATUS_TEXT, "object");
  assert.equal(typeof mod.Status, "object");
  assert.equal(typeof mod.composeMiddleware, "function");
  assert.equal(typeof mod.send, "function");
  assert.equal(Object.keys(mod).length, 8);
});
