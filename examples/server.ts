/*
 * This is a basic example of a test server which provides a logger middleware,
 * a response time middleware, and a basic "Hello World!" middleware.
 */

// Importing some console colors
import { color } from "https://deno.land/x/std@v0.2.4/colors/main.ts";

import { Application } from "../mod.ts";

(async () => {
  const app = new Application();

  // Logger
  app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(
      `${color.green(ctx.request.method)} ${color.blue(
        ctx.request.url
      )} - ${color.bold(String(rt))}`
    );
  });

  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
  });

  app.use(ctx => {
    ctx.response.body = "Hello World!";
  });

  const address = "127.0.0.1:8000";
  console.log(color.bold("Start listening on ") + color.yellow(address));
  await app.listen(address);
  console.log(color.bold("Finished."));
})();
