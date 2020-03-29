import {
  green,
  cyan,
  bold,
  yellow
} from "https://deno.land/std@v0.38.0/fmt/colors.ts";

import { Application } from "../mod.ts";

const app = new Application();

// Logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(
    `${green(ctx.request.method)} ${cyan(ctx.request.url)} - ${bold(
      String(rt),
    )}`,
  );
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

app.use(async (ctx) => {
  if (ctx.request.hasBody) {
    const body = await ctx.request.body();
    let requestText: string;
    if (body) {
      switch (body.type) {
        case "json":
        case "form":
        case "text":
      }
      ctx.response.body =
        `<!DOCTYPE html><html><body><h1>Body type: "${body.type}"`;
    }
  } else {
    ctx.response.body =
      `<!DOCTYPE html><html><body><h1>No Body</h1></body></html>`;
  }
});

const address = "127.0.0.1:8000";
console.log(bold("Start listening on ") + yellow(address));
await app.listen(address);
console.log(bold("Finished."));
