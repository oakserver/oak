/*
 * This is a basic example of a test server that listens on HTTPS and when using
 * the native HTTP server in Deno, will automatically server HTTP/2.
 *
 * This server uses self-signed encryption certificates, which also has a custom
 * root certificate authority. To use it as configured, you need to install and
 * trust the `tls/RootCA.crt` on your local system.
 */

// Importing some console colors
import {
  bold,
  cyan,
  green,
  yellow,
} from "https://deno.land/std@0.217.0/fmt/colors.ts";

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

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
  console.log(bold("  using HTTP server: " + yellow(serverType)));
});

await app.listen({
  port: 8000,
  secure: true,
  cert: Deno.readTextFileSync("./examples/tls/localhost.crt"),
  key: Deno.readTextFileSync("./examples/tls/localhost.key"),
});
console.log(bold("Finished."));
