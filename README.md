# oak

[![][tci badge]][tci link]
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/oak/mod.ts)

A middleware framework for Deno's
[http](https://github.com/denoland/deno_std/tree/master/http#http) server,
including a router middleware.

This middleware framework is inspired by [Koa](https://github.com/koajs/koa)
and middleware router inspired by
[koa-router](https://github.com/alexmingoia/koa-router/).

This README focuses on the mechanics of the oak APIs and is intended for those
who are familiar with JavaScript middleware frameworks like Express and Koa as
well as a decent understanding of Deno. If you aren't familiar with these,
please check out documentation on
[oakserver.github.io/oak](https://oakserver.github.io/oak).

## Application, middleware, and context

The `Application` class wraps the `serve()` function from the `http` package. It
has two methods: `.use()` and `.listen()`. Middleware is added via the
`.use()` method and the `.listen()` method will start the server and start
processing requests with the registered middleware.

A basic usage, responding to every request with _Hello World!_:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

await app.listen({ port: 8000 });
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
app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

await app.listen({ port: 8000 });
```

An instance of application has some properties as well:

- `.keys`

  Keys to be used when signing and verifying cookies. The value can be set to
  an array of keys, and instance of `KeyStack`, or an object which provides the
  same interface as `KeyStack` (e.g. an instance of
  [keygrip](https://github.com/crypto-utils/keygrip)). If just the keys are
  passed, oak will manage the keys via `KeyStack` which allows easy key rotation
  without requiring re-signing of data values.

- `.state`

  A record of application state, which can be strongly typed by specifying a
  generic argument when constructing an `Application()`, or inferred by passing
  a state object (e.g. `Application({ state })`).

### Context

The context passed to middleware has several properties:

- `.app`

  A reference to the `Application` that is invoking this middleware.

- `.cookies`

  The `Cookies` instance for this context which allows you to read and set
  cookies.

- `.request`

  The `Request` object which contains details about the request.

- `.response`

  The `Response` object which will be used to form the response sent back to
  the requestor.

- `.state`

  A record of application state, which can be strongly typed by specifying a
  generic argument when constructing an `Application()`, or inferred by passing
  a state object (e.g. `Application({ state })`).

The context passed to middleware has two methods:

- `.assert()`

  Makes an assertion, which if not true, throws an `HTTPError`, which subclass
  is identified by the second argument, with the message being the third
  argument.

- `.throw()`

  Throws an `HTTPError`, which subclass is identified by the first argument,
  with the message being passed as the second.

Unlike other middleware frameworks, `context` does not have a significant
amount of aliases. The information about the request is only located in
`.request` and the information about the response is only located in
`.response`.

#### Cookies

The `context.cookies` allows access to the values of cookies in the request,
and allows cookies to be set in the response. It automatically secures cookies
if the `.keys` property is set on the application. It has several methods:

- `.get(key: string, options?: CookieGetOptions)`

  Attempts to retrieve the cookie out of the request and returns the value of
  the cookie based on the key. If the applications `.keys` is set, then the
  cookie will be verified against a signed version of the cookie. If the
  cookie is valid, the value will be returned. If it is invalid, the cookie
  signature will be set to deleted on the response. If the cookie was not
  signed by the current key, it will be resigned and added to the response.

- `.set(key: string, value: string, options?: CookieSetDeleteOptions)`

  Will set a cookie in the response based on the provided key, value and any
  options. If the applications `.keys` is set, then the cookie will be signed
  and the signature added to the response.

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

- `.protocol`

  Either `http` or `https` based on the request.

- `.search`

  The raw search string part of the request.

- `.searchParams`

  An instance of `URLSearchParams` which contain the parsed value of the search
  part of the request URL.

- `.secure`

  A shortcut for `.protocol`, returning `true` if HTTPS otherwise `false`.

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
  available and contains a `.body` reader.

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
import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const books = new Map<string, any>();
books.set("1", {
  id: "1",
  title: "The Hound of the Baskervilles",
  author: "Conan Doyle, Author",
});

const router = new Router();
router
  .get("/", (context) => {
    context.response.body = "Hello world!";
  })
  .get("/book", (context) => {
    context.response.body = Array.from(books.values());
  })
  .get("/book/:id", (context) => {
    if (context.params && context.params.id && books.has(context.params.id)) {
      context.response.body = books.get(context.params.id);
    }
  });

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
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

  app.use(async (context) => {
    await send(context, context.request.path, {
      root: `${Deno.cwd()}/examples/static`,
      index: "index.html",
    });
  });

  await app.listen({ port: 8000 });
})();
```

---

There are several modules that are directly adapted from other modules. They
have preserved their individual licenses and copyrights. All of the modules,
including those directly adapted are licensed under the MIT License.

All additional work is copyright 2018 - 2020 the oak authors. All rights
reserved.

[tci badge]: https://travis-ci.com/oakserver/oak.svg?branch=master
[tci link]: https://travis-ci.com/oakserver/oak
