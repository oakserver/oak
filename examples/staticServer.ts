import { color } from "https://deno.land/x/std@v0.2.4/colors/main.ts";

import * as deno from "deno";
import { Application, HttpError, send, Status } from "../mod.ts";

(async () => {
  const app = new Application();

  // Error handler middleware
  app.use(async (context, next) => {
    try {
      await next();
    } catch (e) {
      if (e instanceof HttpError) {
        context.response.status = e.status as any;
        if (e.expose) {
          context.response.body = `<!DOCTYPE html>
            <html>
              <body>
                <h1>${e.status} - ${e.message}</h1>
              </body>
            </html>`;
        } else {
          context.response.body = `<!DOCTYPE html>
            <html>
              <body>
                <h1>${e.status} - ${Status[e.status]}</h1>
              </body>
            </html>`;
        }
      } else if (e instanceof Error) {
        context.response.status = 500;
        context.response.body = `<!DOCTYPE html>
            <html>
              <body>
                <h1>500 - Internal Server Error</h1>
              </body>
            </html>`;
        console.log("Unhandled Error:", color.red.bold(e.message));
        console.log(e.stack);
      }
    }
  });

  // Logger
  app.use(async (context, next) => {
    await next();
    const rt = context.response.headers.get("X-Response-Time");
    console.log(
      `${color.green(context.request.method)} ${color.blue(
        context.request.url
      )} - ${color.bold(String(rt))}`
    );
  });

  // Response Time
  app.use(async (context, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    context.response.headers.set("X-Response-Time", `${ms}ms`);
  });

  // Send static content
  app.use(async context => {
    await send(context, context.request.path, {
      root: `${deno.cwd()}/examples/static`,
      index: "index.html"
    });
  });

  const address = "127.0.0.1:8000";
  console.log(color.bold("Start listening on ") + color.yellow(address));
  await app.listen(address);
})();
