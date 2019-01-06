import { assert, test } from "https://deno.land/x/testing/testing.ts";

import { send } from "./send.ts";

test(function basicSend() {
  assert(send != null);
});
