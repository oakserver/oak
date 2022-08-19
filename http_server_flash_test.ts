// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { hasFlash } from "./http_server_flash.ts";

Deno.test({
  name: "",
  ignore: !hasFlash(),
  fn() {},
});
