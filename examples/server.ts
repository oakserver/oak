import { color } from "https://deno.land/x/colors/main.ts";

import { Application } from "../main";

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
    ctx.response.body = "Awesome!";
  });

  console.log(color.bold("Start..."));
  await app.listen("127.0.0.1:8000");
  console.log(color.bold("Finished."));
})().catch(err => {
  console.log(`app error: ${err.stack}`);
};;
