/*
 * This is a basic example of a test server which sets a last visit cookie.
 */

// Importing some console colors
import {
  green,
  cyan,
  bold,
  yellow,
} from "https://deno.land/std@v1.0.0-rc1/fmt/colors.ts";

import { Application } from "../mod.ts";

const app = new Application();

// Logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(
    `${green(ctx.request.method)} ${cyan(ctx.request.url.pathname)} - ${
      bold(
        String(rt),
      )
    }`,
  );
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

app.use((ctx) => {
  const lastVisit = ctx.cookies.get("lastVisit");
  ctx.cookies.set("lastVisit", new Date().toISOString());
  if (lastVisit) {
    ctx.response.body = `Welcome back. You were last here at ${lastVisit}.`;
  } else {
    ctx.response.body = `Welcome, I haven't seen your before.`;
  }
});

const address = "127.0.0.1:8000";
console.log(bold("Start listening on ") + yellow(address));
await app.listen(address);
console.log(bold("Finished."));
