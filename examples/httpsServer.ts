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
} from "https://deno.land/std@v0.39.0/fmt/colors.ts";

import { Application, HTTPSOptions } from "../mod.ts";

const app = new Application();

// Logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(
    `${green(ctx.request.method)} ${cyan(ctx.request.url)} - ${
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

const options: HTTPSOptions = {
  port: 8000,
  certFile: "./examples/tls/localhost.crt",
  keyFile: "./examples/tls/localhost.key",
};
console.log(bold("Start listening on ") + yellow(String(options.port)));
await app.listenTLS(options);
console.log(bold("Finished."));
