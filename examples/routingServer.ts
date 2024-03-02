/*
 * This is an example of a server that utilizes the router.
 */

// Importing some console colors
import {
  bold,
  cyan,
  green,
  yellow,
} from "https://deno.land/std@0.218.2/fmt/colors.ts";

import {
  Application,
  Context,
  isHttpError,
  Router,
  RouterContext,
  Status,
} from "../mod.ts";

interface Book {
  id: string;
  title: string;
  author: string;
}

const books = new Map<string, Book>();

books.set("1234", {
  id: "1234",
  title: "The Hound of the Baskervilles",
  author: "Conan Doyle, Author",
});

function notFound(context: Context) {
  context.response.status = Status.NotFound;
  context.response.body =
    `<html><body><h1>404 - Not Found</h1><p>Path <code>${context.request.url}</code> not found.`;
}

const router = new Router();
router
  .get("/", (context) => {
    context.response.body = "Hello world!";
  })
  .get("/book", (context) => {
    context.response.body = Array.from(books.values());
  })
  .post("/book", async (context: RouterContext<"/book">) => {
    console.log("post book");
    if (!context.request.hasBody) {
      context.throw(Status.BadRequest, "Bad Request");
    }
    const body = context.request.body;
    let book: Partial<Book> | undefined;
    if (body.type() === "json") {
      book = await body.json();
    } else if (body.type() === "form") {
      book = {};
      for (const [key, value] of await body.form()) {
        book[key as keyof Book] = value;
      }
    } else if (body.type() === "form-data") {
      book = {};
      for (const [key, value] of await body.formData()) {
        book[key as keyof Book] = value as string;
      }
    }
    if (book) {
      context.assert(book.id && typeof book.id === "string", Status.BadRequest);
      books.set(book.id, book as Book);
      context.response.status = Status.OK;
      context.response.body = book;
      context.response.type = "json";
      return;
    }
    context.throw(Status.BadRequest, "Bad Request");
  })
  .get("/book/:id", (context) => {
    if (context.params && books.has(context.params.id)) {
      context.response.body = books.get(context.params.id);
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
    `${green(context.request.method)} ${
      cyan(decodeURIComponent(context.request.url.pathname))
    } - ${
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

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
  console.log(bold("  using HTTP server: " + yellow(serverType)));
});

await app.listen({ hostname: "127.0.0.1", port: 8000 });
console.log(bold("Finished."));
