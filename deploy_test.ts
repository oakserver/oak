// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { createWorker } from "https://deno.land/x/dectyl@0.10.7/mod.ts";
import { assertEquals } from "./test_deps.ts";

const notUnstable = (() => {
  return !(Deno && "emit" in Deno && typeof Deno.emit === "function");
})();

Deno.test({
  name: "deploy - request event API",
  ignore: notUnstable,
  async fn() {
    const worker = await createWorker("./fixtures/deploy_request_event.ts", {
      bundle: false,
    });
    await worker.run(async () => {
      const logs: string[] = [];
      (async () => {
        for await (const log of worker.logs) {
          console.log(log);
          logs.push(log);
        }
      })();
      const [response] = await worker.fetch("/");
      assertEquals(await response.json(), {
        headers: [["host", "localhost"], ["x-forwarded-for", "127.0.0.1"]],
        ip: "127.0.0.1",
        ips: [],
        secure: false,
        url: "https://localhost/",
      });
    });
  },
});
