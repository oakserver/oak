// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

Deno.test({
  name: "bundle can load",
  async fn() {
    const { Application, Router } = await import("./oak.bundle.js");
    const router = new Router();
    const app = new Application();
    app.use(router.routes());
  },
});
