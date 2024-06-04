// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { assertEquals } from "../deps_test.ts";
import { decodeComponent } from "./decode_component.ts";

Deno.test({
  name: "decodeComponent",
  fn() {
    // with decodeURIComponent, this would throw:
    assertEquals(decodeComponent("%"), "%");
  },
});
