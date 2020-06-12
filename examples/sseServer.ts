/*
 * This is an example of a server that utilizes the router.
 */

// Importing some console colors
import {
  green,
  cyan,
  bold,
  yellow,
} from "https://deno.land/std@0.57.0/fmt/colors.ts";

import {
  Application,
  Context,
  isHttpError,
  Router,
  ServerSentEvent,
  Status,
} from "../mod.ts";

interface Book {
  id: string;
  title: string;
  author: string;
}

function notFound(ctx: Context) {
  ctx.response.status = Status.NotFound;
  ctx.response.body =
    `<html><body><h1>404 - Not Found</h1><p>Path <code>${ctx.request.url}</code> not found.`;
}

const router = new Router();
router
  .get("/", async (ctx) => {
    await ctx.send(
      {
        root: `${Deno.cwd()}/examples/resources`,
        path: "sseServer_index.html",
      },
    );
  })
  // for any clients that request the `/sse` endpoint, we will send a message
  // every 2 seconds.
  .get("/sse", (ctx: Context) => {
    ctx.assert(
      ctx.request.accepts("text/event-stream"),
      Status.UnsupportedMediaType,
    );
    const connection = `${
      (ctx.request.serverRequest.conn.remoteAddr as Deno.NetAddr).hostname
    }:${(ctx.request.serverRequest.conn.remoteAddr as Deno.NetAddr).port}`;
    const target = ctx.sendEvents();
    console.log(`${green("SSE connect")} ${cyan(connection)}`);
    let counter = 0;
    const id = setInterval(() => {
      const evt = new ServerSentEvent(
        "message",
        { hello: "world" },
        { id: counter++ },
      );
      target.dispatchEvent(evt);
    }, 2000);
    target.addEventListener("close", () => {
      console.log(`${green("SSE disconnect")} ${cyan(connection)}`);
      clearInterval(id);
    });
  });

const app = new Application();

// Logger
app.use(async (context, next) => {
  await next();
  const rt = context.response.headers.get("X-Response-Time");
  console.log(
    `${green(context.request.method)} ${cyan(context.request.url.pathname)} - ${
      bold(
        String(rt),
      )
    }`,
  );
});

// Response Time
app.use(async (context, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  context.response.headers.set("X-Response-Time", `${ms}ms`);
});

// Error handler
app.use(async (context, next) => {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      context.response.status = err.status;
      const { message, status, stack } = err;
      if (context.request.accepts("json")) {
        context.response.body = { message, status, stack };
        context.response.type = "json";
      } else {
        context.response.body = `${status} ${message}\n\n${stack ?? ""}`;
        context.response.type = "text/plain";
      }
    } else {
      console.log(err);
      throw err;
    }
  }
});

// Use the router
app.use(router.routes());
app.use(router.allowedMethods());

// A basic 404 page
app.use(notFound);

app.addEventListener("listen", ({ hostname, port }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
});

await app.listen({ hostname: "127.0.0.1", port: 8000 });
console.log(bold("Finished."));
