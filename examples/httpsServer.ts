/*
 * This is a basic example of a test server which provides a logger middleware,
 * a response time middleware, and a basic "Hello World!" middleware.
 */

// Importing some console colors
import {
  green,
  cyan,
  bold,
  yellow,
} from "https://deno.land/std@0.57.0/fmt/colors.ts";

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
  ctx.response.body = "Hello World!";
});

app.addEventListener("listen", ({ hostname, port }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
});

await app.listen({
  port: 8000,
  secure: true,
  certFile: "./examples/tls/localhost.crt",
  keyFile: "./examples/tls/localhost.key",
});
console.log(bold("Finished."));
