// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { isNode } from "./util.ts";

const BUNDLE = "./oak.bundle.js";

Deno.test({
  name: "bundle can load",
  ignore: isNode(),
  async fn() {
    const { Application, Router } = await import(BUNDLE);
    const router = new Router();
    const app = new Application();
    app.use(router.routes());
  },
});
