/*
 * This is an example of a server that utilizes the router.
 */

// Importing some console colors
import { color } from "https://deno.land/x/std@v0.2.4/colors/main.ts";

import { Application, Context, Router, Status } from "../mod.ts";

interface Book {
  id: string;
  title: string;
  author: string;
}

const books = new Map<string, Book>();

books.set("1234", {
  id: "1234",
  title: "The Hound of the Baskervilles",
  author: "Conan Doyle, Author"
});

function notFound(context: Context) {
  context.response.status = Status.NotFound;
  context.response.body = `<html><body><h1>404 - Not Found</h1><p>Path <code>${
    context.request.url
  }</code> not found.`;
}

(async () => {
  const router = new Router();
  router
    .get("/", (context, next) => {
      context.response.body = "Hello world!";
      return next();
    })
    .get("/book", async (context, next) => {
      context.response.body = Array.from(books.values());
      return next();
    })
    .get<{ id: string }>("/book/:id", async (context, next) => {
      if (context.params && books.has(context.params.id)) {
        context.response.body = books.get(context.params.id);
        return next();
      } else {
        return notFound(context);
      }
    });

  const app = new Application();

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

  // Use the router
  app.use(router.routes());
  app.use(router.allowedMethods());

  // A basic 404 page
  app.use(notFound);

  const address = "127.0.0.1:8000";
  console.log(color.bold("Start listening on ") + color.yellow(address));
  await app.listen(address);
  console.log(color.bold("Finished."));
})();
