// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { test, assertEquals } from "./test_deps.ts";
import { preferredEncodings } from "./encoding.ts";

test(function encoding() {
  assertEquals(preferredEncodings("gzip, compress;q=0.2, identity;q=0.5"), [
    "gzip",
    "identity",
    "compress",
  ]);
});

test(function availableEncoding() {
  assertEquals(
    preferredEncodings("gzip, compress;q=0.2, identity;q=0.5", [
      "identity",
      "gzip",
    ]),
    ["gzip", "identity"],
  );
});
