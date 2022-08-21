/*
 * This is a basic example of a test server which sets a last visit cookie.
 */

// Importing some console colors
import {
  bold,
  cyan,
  green,
  yellow,
} from "https://deno.land/std@0.152.0/fmt/colors.ts";

import { Application } from "../mod.ts";

const app = new Application({
  // This will be used to sign cookies to help prevent cookie tampering
  keys: ["secret1"],
});

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

app.use(async (ctx) => {
  const lastVisit = await ctx.cookies.get("lastVisit");
  await ctx.cookies.set("lastVisit", new Date().toISOString());
  if (lastVisit) {
    ctx.response.body = `Welcome back. You were last here at ${lastVisit}.`;
  } else {
    ctx.response.body = `Welcome, I haven't seen your before.`;
  }
});

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
  console.log(bold("  using HTTP server: " + yellow(serverType)));
});

await app.listen({ hostname: "127.0.0.1", port: 8000 });
console.log(bold("Finished."));
