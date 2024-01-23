/*
 * This is an example of a server which will take whatever the request is and
 * respond back with information about the request.
 */

import { Application } from "../mod.ts";

const app = new Application();

// Logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(
    `%c${ctx.request.method} %c${ctx.request.url.pathname}%c - %c${rt}`,
    "color:green",
    "color:cyan",
    "color:none",
    "font-weight:bold",
  );
  const ua = ctx.request.userAgent;
  console.log(
    `  ${ua.browser.name}@${ua.browser.major} %c(${ua.os.name}@${ua.os.version})`,
    "color:grey",
  );
  console.log(ua.ua);
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
    const body = ctx.request.body;
    ctx.response.body = `<!DOCTYPE html><html><body>
          <h1>Body type: "${body.type()}"</h1>`;
    switch (body.type()) {
      case "form":
        ctx.response.body +=
          `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>`;
        for (const [key, value] of await body.form()) {
          ctx.response.body += `<tr><td>${key}</td><td>${value}</td></tr>`;
        }
        ctx.response.body += `</tbody></table>`;
        break;
      case "form-data": {
        const formData = await body.formData();
        ctx.response.body +=
          `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>`;
        for (const [key, value] of formData) {
          ctx.response.body += `<tr><td>${key}</td><td>${
            typeof value === "string"
              ? value
              : `file: ${value.name}<br/>size: ${value.size}<br/>type: ${value.type}`
          }</td></tr>`;
          if (value instanceof File) {
            console.log(await value.arrayBuffer());
          }
        }
        ctx.response.body += `</tbody></table>`;
        break;
      }
      case "text":
        ctx.response.body += `<pre>${await body.text()}</pre>`;
        break;
      case "json":
        ctx.response.body += `<pre>${
          JSON.stringify(await body.json(), undefined, "  ")
        }</pre>`;
        break;
      case "binary":
        ctx.response.body += `<h2>Content Type: "${
          ctx.request.headers.get("content-type")
        }"</h2>`;
        ctx.response.body += `<pre>${
          decoder.decode(await body.arrayBuffer())
        }</pre>`;
        break;
      case "unknown":
        ctx.response.body +=
          `<div>Unable to determine body type.</div><h2>Content Type: "${
            ctx.request.headers.get("content-type")
          }"</h2>`;
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
    `%cStart listening on %c${hostname}:${port}`,
    "font-weight:bold",
    "color:yellow;font-weight:normal",
  );
  console.log(
    `  %cusing HTTP server: %c${serverType}`,
    "font-weight:bold",
    "color:yellow; font-weight:normal",
  );
});

await app.listen({ hostname: "127.0.0.1", port: 8000 });
console.log("%cFinished.", "font-weight:bold");
