import { test, assert } from "https://deno.land/x/std/testing/mod.ts";
import { preferredEncodings } from "./encoding.ts";

test(function encoding() {
  assert.equal(preferredEncodings("gzip, compress;q=0.2, identity;q=0.5"), [
    "gzip",
    "identity",
    "compress"
  ]);
});

test(function availableEncoding() {
  assert.equal(
    preferredEncodings("gzip, compress;q=0.2, identity;q=0.5", [
      "identity",
      "gzip"
    ]),
    ["gzip", "identity"]
  );
});
