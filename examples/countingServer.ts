/* This is an example of how to use an object as a middleware.
 * `MiddlewareObject` can be ideal for when a middleware needs to encapsulate
 * large amounts of logic or its own state. */

import {
  bold,
  cyan,
  green,
  yellow,
} from "https://deno.land/std@0.218.2/fmt/colors.ts";

import {
  Application,
  composeMiddleware,
  type Context,
  type MiddlewareObject,
  type Next,
} from "../mod.ts";

const app = new Application();

class CountingMiddleware implements MiddlewareObject {
  #id = 0;
  #counter = 0;

  init() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    this.#id = array[0];
  }

  handleRequest(ctx: Context, next: Next) {
    ctx.response.headers.set("X-Response-Count", String(this.#counter++));
    ctx.response.headers.set("X-Response-Counter-ID", String(this.#id));
    return next();
  }
}

class LoggerMiddleware implements MiddlewareObject {
  #composedMiddleware: (context: Context, next: Next) => Promise<unknown>;

  constructor() {
    this.#composedMiddleware = composeMiddleware([
      this.#handleLogger,
      this.#handleResponseTime,
    ]);
  }

  async #handleLogger(ctx: Context, next: Next) {
    await next();
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(
      `${green(ctx.request.method)} ${cyan(ctx.request.url.pathname)} - ${
        bold(
          String(rt),
        )
      }`,
    );
  }

  async #handleResponseTime(ctx: Context, next: Next) {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
  }

  handleRequest(ctx: Context, next: Next) {
    return this.#composedMiddleware(ctx, next);
  }
}

app.use(new CountingMiddleware());
app.use(new LoggerMiddleware());

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
  console.log(bold("  using HTTP server: " + yellow(serverType)));
});

await app.listen({ hostname: "127.0.0.1", port: 8000 });
console.log(bold("Finished."));
