/*
 * This is an example of a server which will take whatever the request is and
 * respond back with information about the request.
 */

import {
  bold,
  cyan,
  green,
  yellow,
} from "https://deno.land/std@0.152.0/fmt/colors.ts";

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

const decoder = new TextDecoder();

app.use(async (ctx) => {
  if (ctx.request.hasBody) {
    const body = ctx.request.body();
    ctx.response.body = `<!DOCTYPE html><html><body>
          <h1>Body type: "${body.type}"</h1>`;
    switch (body.type) {
      case "form":
        ctx.response.body +=
          `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>`;
        for (const [key, value] of await body.value) {
          ctx.response.body += `<tr><td>${key}</td><td>${value}</td></tr>`;
        }
        ctx.response.body += `</tbody></table>`;
        break;
      case "form-data": {
        const { fields } = await body.value.read();
        ctx.response.body +=
          `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>`;
        for (const [key, value] of Object.entries(fields)) {
          ctx.response.body += `<tr><td>${key}</td><td>${value}</td></tr>`;
        }
        ctx.response.body += `</tbody></table>`;
        break;
      }
      case "text":
        ctx.response.body += `<pre>${body.value}</pre>`;
        break;
      case "json":
        ctx.response.body += `<pre>${
          JSON.stringify(await body.value, undefined, "  ")
        }</pre>`;
        break;
      case "bytes":
        ctx.response.body += `<h2>Content Type: "${
          ctx.request.headers.get("content-type")
        }"</h2>`;
        ctx.response.body += `<pre>${decoder.decode(await body.value)}</pre>`;
        break;
      default:
        ctx.response.body += `<p><strong>Body is Undefined</strong></p>`;
    }
    ctx.response.body += `</body></html>`;
  } else {
    ctx.response.body =
      `<!DOCTYPE html><html><body><h1>No Body</h1></body></html>`;
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
