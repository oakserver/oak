import { assert, test } from "https://deno.land/x/std/testing/mod.ts";

import { send } from "./send.ts";

test(function basicSend() {
  assert(send != null);
});
