// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, test } from "./test_deps.ts";
import * as mod from "./mod.ts";

test(function publicApi() {
  assert(mod != null);
  assertEquals(typeof mod.Application, "function");
  assertEquals(typeof mod.Context, "function");
  assertEquals(typeof mod.HttpError, "function");
  assertEquals(typeof mod.composeMiddleware, "function");
  assertEquals(typeof mod.BodyType, "object");
  assertEquals(typeof mod.Request, "function");
  assertEquals(typeof mod.Response, "function");
  assertEquals(typeof mod.Router, "function");
  assertEquals(typeof mod.STATUS_TEXT, "object");
  assertEquals(typeof mod.Status, "object");
  assertEquals(typeof mod.send, "function");
  assertEquals(Object.keys(mod).length, 11);
});
