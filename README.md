# oak

[![][tci badge]][tci link]

A middleware framework for Deno's
[http](https://github.com/denoland/deno_std/tree/master/http#http) server,
including a router middleware.

This middleware framework is inspired by [Koa](https://github.com/koajs/koa)
and middleware router inspired by
[koa-router](https://github.com/alexmingoia/koa-router/).

## Application, middleware, and context

The `Application` class wraps the `serve()` function from the `http` package. It
has two methods: `.use()` and `.listen()`. Middleware is added via the
`.use()` method and the `.listen()` method will start the server and start
processing requests with the registered middleware.

A basic usage, responding to every request with _Hello World!_:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use(ctx => {
  ctx.response.body = "Hello World!";
});

await app.listen("127.0.0.1:8000");
```

The middleware is processed as a stack, where each middleware function can
control the flow of the response. When the middleware is called, it is passed
a context and reference to the "next" method in the stack.

A more complex example:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

// Logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// Timing
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

// Hello World!
app.use(ctx => {
  ctx.response.body = "Hello World!";
});

await app.listen("127.0.0.1:8000");
```

### Context

The context passed to middleware has several properties:

- `.app`

  A reference to the `Application` that is invoking this middleware.

- `.request`

  The `Request` object which contains details about the request.

- `.response`

  The `Response` object which will be used to form the response sent back to
  the requestor.

- `.state`

  A "map" of application state, which can be strongly typed by specifying a
  generic argument when constructing and `Application`.

The context passed to middleware has one method:

- `.throws()`

  Throws an `HTTPError`, which subclass is identified by the first argument,
  with the message being passed as the second.

Unlike other middleware frameworks, `context` does not have a significant
amount of aliases. The information about the request is only located in
`.request` and the information about the response is only located in
`.response`.

#### Request

The `context.request` contains information about the request. It contains
several properties:

- `.hasBody`

  Set to `true` if the request has a body, or `false` if it does not. It does
  not validate if the body is supported by the built in body parser though.

- `.headers`

  The headers for the request, an instance of `Headers`.

- `.method`

  A string that represents the HTTP method for the request.

- `.path`

  The path part of the request URL.

- `.search`

  The raw search string part of the request.

- `.searchParams`

  An instance of `URLSearchParams` which contain the parsed value of the search
  part of the request URL.

- `.severRequest`

  The original `net` server request.

- `.url`

  _TODO_ currently the same as `.path`, logic needs to be added to determine
  the requested host.

And several methods:

- `.accepts(...types: string[])`

  Negotiates the content type supported by the request for the response. If no
  content types are passed, the method returns a prioritized array of accepted
  content types. If content types are passed, the best negotiated content type
  is returned. If there is no content type matched, then `undefined` is
  returned.

- `.acceptsCharsets(...charsets: string[])`

  To be implemented.

- `.acceptsEncodings(...encodings: string[])`

  Negotiates the content encoding supported by the request for the response. If
  no encodings are passed, the method returns a prioritized array of accepted
  encodings. If encodings are passed, the best negotiated encoding is returned.
  If there are no encodings matched, then `undefined` is returned.

- `.acceptsLanguages(...languages: string[])`

  To be implemented.

- `.body()`

  The method resolves to a parsed version of the request body. Currently oak
  supports request body types of JSON, text and URL encoded form data. If the
  content type of the request is not supported, the request will be rejected
  with a 415 HTTP Error.

  If the content type is supported, the method resolves with an object which
  contains a `type` property set to `"json"`, `"text"`, `"form"`, or
  `"undefined"` and a `value` property set with the parsed value of the
  property. For JSON it will be the parsed value of the JSON string. For text,
  it will simply be a string and for a form, it will be an instance of
  `URLSearchParams`. For an undefined body, the value will be `undefined`.

  For more advanced use cases of the body, the original server request is
  available and contains a `.body()` and `.bodyStream()` methods.

### Automatic response body handling

When the response `Content-Type` is not set in the headers of the `.response`,
oak will automatically try to determine the appropriate `Content-Type`. First
it will look at `.response.type`. If assigned, it will try to resolve the
appropriate media type based on treating the value of `.type` as either the
media type, or resolving the media type based on an extension. For example if
`.type` was set to `".html"`, then the `Content-Type` will be set to
`"text/html"`.

If `.type` is not set with a value, then oak will inspect the value of
`.response.body`. If the value is a `string`, then oak will check to see if
the string looks like HTML, if so, `Content-Type` will be set to `text/html`
otherwise it will be set to `text/plain`. If the value is an object, other
than a `Uint8Array` or `null`, the object will be passed to `JSON.stringify()`
and the `Content-Type` will be set to `application/json`.

## Router

The `Router` class produces middleware which can be used with an `Application`
to enable routing based on the pathname of the request.

### Basic usage

The following example serves up a _RESTful_ service of a map of books, where
`http://localhost:8000/book/` will return an array of books and
`http://localhost:8000/book/1` would return the book with ID `"1"`:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const books = new Map<string, any>();
books.set("1", {
  id: "1",
  title: "The Hound of the Baskervilles",
  author: "Conan Doyle, Author"
});

const app = new Application();
const router = app.createRouter();
router
  .get("/", context => {
    context.response.body = "Hello world!";
  })
  .get("/book", context => {
    context.response.body = Array.from(books.values());
  })
  .get("/book/:id", context => {
    if (context.params && books.has(context.params.id)) {
      context.response.body = books.get(context.params.id);
    }
  });

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen("127.0.0.1:8000");
```

### Safely extend Application context type

```ts
import { Application, Context } from "https://deno.land/x/oak/mod.ts";

const Users = new Map<string, string>();
Users.set("1", "Jack");

const app = new Application()
  .use((ctx: Context<{ user: { id: string } }>, next) => {
    ctx.state.user.id = ctx.request.headers.get("uid");
    return next();
  })
  .use((ctx: Context<{ user: { name: string } }>, next) => {
    // safe to access ctx.state.user.id now
    ctx.state.user.name = Users.get(ctx.state.user.id);
    return next();
  });

const router = app.createRouter();
router.get("/logout", context => {
  // ctx's type generated from all previous application middlewares
  ctx.response.body = `user ${ctx.state.user.name}(${ctx.state.user.id}) logged out`;
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen("127.0.0.1:8000");
```

## Static content

The function `send()` is designed to serve static content as part of a
middleware function. In the most straight forward usage, a root is provided
and requests provided to the function are fulfilled with files from the local
file system relative to the root from the requested path.

A basic usage would look something like this:

```ts
import { Application, send } from "https://deno.land/x/oak/mod.ts";

(async () => {
  const app = new Application();

  app.use(async context => {
    await send(context, context.request.path, {
      root: `${Deno.cwd()}/examples/static`,
      index: "index.html"
    });
  });

  await app.listen("127.0.0.1:8000");
})();
```

---

There are several modules that are directly adapted from other modules. They
have preserved their individual licenses and copyrights. All of the modules,
including those directly adapted are licensed under the MIT License.

All additional work is copyright 2018 - 2019 the oak authors. All rights
reserved.

[tci badge]: https://travis-ci.com/oakserver/oak.svg?branch=master
[tci link]: https://travis-ci.com/oakserver/oak
