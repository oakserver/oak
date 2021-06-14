// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assertEquals, createWorker } from "./test_deps.ts";

const notUnstable = (() => {
  return !(Deno && "emit" in Deno && typeof Deno.emit === "function");
})();

Deno.test({
  name: "deploy - basic test",
  ignore: notUnstable,
  async fn() {
    const worker = await createWorker("./fixtures/deploy_diagnostics.ts");
    await worker.run(async () => {
      const [response] = await worker.fetch("/");
      assertEquals(await response.json(), {
        headers: [["host", "localhost"], ["x-forwarded-for", "127.0.0.1"]],
        ip: "127.0.0.1",
        ips: ["127.0.0.1"],
        secure: true,
        url: "http://localhost/",
      });
    });
  },
});
