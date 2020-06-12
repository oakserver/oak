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

app.use(async (ctx) => {
  if (ctx.request.hasBody) {
    const body = await ctx.request.body();
    if (body) {
      ctx.response.body = `<!DOCTYPE html><html><body>
          <h1>Body type: "${body.type}"</h1>`;
      switch (body.type) {
        case "form":
          ctx.response.body +=
            `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>`;
          for (const [key, value] of body.value) {
            ctx.response.body += `<tr><td>${key}</td><td>${value}</td></tr>`;
          }
          ctx.response.body += `</tbody></table>`;
        case "text":
          ctx.response.body += `<pre>${body.value}</pre>`;
          break;
        case "json":
          ctx.response.body += `<pre>${
            JSON.stringify(body.value, undefined, "  ")
          }</pre>`;
          break;
        case "raw":
          ctx.response.body += `<pre>${String(body.value)}</pre>`;
          break;
        default:
          ctx.response.body += `<p><strong>Body is Undefined</strong></p>`;
      }
      ctx.response.body += `</body></html>`;
    }
  } else {
    ctx.response.body =
      `<!DOCTYPE html><html><body><h1>No Body</h1></body></html>`;
  }
});

app.addEventListener("listen", ({ hostname, port }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
});

await app.listen({ hostname: "127.0.0.1", port: 8000 });
console.log(bold("Finished."));
