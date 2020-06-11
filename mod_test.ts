// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, test } from "./test_deps.ts";
import * as mod from "./mod.ts";

test({
  name: "public API assertions",
  fn() {
    assert(mod != null);
    assertEquals(typeof mod.Application, "function");
    assertEquals(typeof mod.Context, "function");
    assertEquals(typeof mod.FormDataReader, "function");
    assertEquals(typeof mod.helpers, "object");
    assertEquals(typeof mod.helpers.getQuery, "function");
    assertEquals(Object.keys(mod.helpers).length, 1);
    assertEquals(typeof mod.HttpError, "function");
    assertEquals(typeof mod.httpErrors, "object");
    assertEquals(typeof mod.isErrorStatus, "function");
    assertEquals(typeof mod.isHttpError, "function");
    assertEquals(typeof mod.isRedirectStatus, "function");
    assertEquals(typeof mod.composeMiddleware, "function");
    assertEquals(typeof mod.Cookies, "function");
    assertEquals(typeof mod.REDIRECT_BACK, "symbol");
    assertEquals(typeof mod.Request, "function");
    assertEquals(typeof mod.Response, "function");
    assertEquals(typeof mod.Router, "function");
    assertEquals(typeof mod.ServerSentEvent, "function");
    assertEquals(typeof mod.ServerSentEventTarget, "function");
    assertEquals(typeof mod.STATUS_TEXT, "object");
    assertEquals(typeof mod.Status, "object");
    assertEquals(typeof mod.send, "function");
    assertEquals(Object.keys(mod).length, 20);
  },
});
