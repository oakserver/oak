// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals } from "./test_deps.ts";
import * as mod from "./mod.ts";

const { test } = Deno;

test({
  name: "public API assertions",
  fn() {
    assert(mod != null);
    assertEquals(typeof mod.Application, "function");
    assertEquals(typeof mod.Context, "function");
    assertEquals(typeof mod.etag, "object");
    assertEquals(typeof mod.etag.calculate, "function");
    assertEquals(typeof mod.etag.factory, "function");
    assertEquals(typeof mod.FlashServer, "function");
    assertEquals(typeof mod.FormDataReader, "function");
    assertEquals(typeof mod.hasFlash, "function");
    assertEquals(typeof mod.helpers, "object");
    assertEquals(typeof mod.helpers.getQuery, "function");
    assertEquals(Object.keys(mod.helpers).length, 1);
    assertEquals(typeof mod.HttpError, "function");
    assertEquals(typeof mod.httpErrors, "object");
    assertEquals(typeof mod.HttpRequest, "function");
    assertEquals(typeof mod.HttpServerNative, "function");
    assertEquals(typeof mod.isErrorStatus, "function");
    assertEquals(typeof mod.isHttpError, "function");
    assertEquals(typeof mod.isRedirectStatus, "function");
    assertEquals(typeof mod.composeMiddleware, "function");
    assertEquals(typeof mod.Cookies, "function");
    assertEquals(typeof mod.ifRange, "function");
    assertEquals(typeof mod.MultiPartStream, "function");
    assertEquals(typeof mod.parseRange, "function");
    assertEquals(typeof mod.proxy, "function");
    assertEquals(typeof mod.REDIRECT_BACK, "symbol");
    assertEquals(typeof mod.Request, "function");
    assertEquals(typeof mod.Response, "function");
    assertEquals(typeof mod.Router, "function");
    assertEquals(typeof mod.ServerSentEvent, "function");
    assertEquals(typeof mod.STATUS_TEXT, "object");
    assertEquals(typeof mod.Status, "object");
    assertEquals(typeof mod.send, "function");
    assertEquals(typeof mod.testing, "object");
    assertEquals(Object.keys(mod.testing).length, 4);
    assertEquals(Object.keys(mod).length, 30);
  },
});
