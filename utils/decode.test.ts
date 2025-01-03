// Copyright 2018-2025 the oak authors. All rights reserved. MIT license.

import { assert, isHttpError } from "../deps.ts";
import { assertEquals } from "../deps_test.ts";
import { decode } from "./decode.ts";

Deno.test({
  name: "decodeComponent - throws HTTP error",
  fn() {
    try {
      decode("%");
    } catch (err) {
      assert(isHttpError(err));
      assertEquals(err.status, 400);
      assertEquals(err.expose, false);
      return;
    }
    throw Error("unaccessible code");
  },
});
