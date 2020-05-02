// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assert, assertEquals } from "./test_deps.ts";

import httpError, { createHttpError } from "./httpError.ts";

test({
  name: "createHttpError",
  fn() {
    const err = createHttpError(501);
    assert(err instanceof httpError.NotImplemented);
    assertEquals(err.status, 501);
    assertEquals(err.name, "NotImplementedError");
    assertEquals(err.message, "Not Implemented");
  },
});

test({
  name: "httpError.NotImplemented()",
  fn() {
    const err = new httpError.NotImplemented();
    assertEquals(err.status, 501);
    assertEquals(err.name, "NotImplementedError");
    assertEquals(err.message, "Not Implemented");
  },
});
