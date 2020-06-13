# oak

[![oak ci](https://github.com/oakserver/oak/workflows/oak%20ci/badge.svg)](https://github.com/oakserver/oak)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/oak/mod.ts)

A middleware framework for Deno's
[http](https://github.com/denoland/deno_std/tree/master/http#http) server,
including a router middleware.

This middleware framework is inspired by [Koa](https://github.com/koajs/koa)
and middleware router inspired by
[@koa/router](https://github.com/koajs/router/).

This README focuses on the mechanics of the oak APIs and is intended for those
who are familiar with JavaScript middleware frameworks like Express and Koa as
well as a decent understanding of Deno. If you aren't familiar with these,
please check out documentation on
[oakserver.github.io/oak](https://oakserver.github.io/oak).

Also, check out our [FAQs](https://oakserver.github.io/oak/FAQ) and the
[awesome-oak](https://oakserver.github.io/awesome-oak/) site of community
resources.

_Warning_ The examples in this README pull from `master`, which may not make
sense to do when you are looking to actually deploy a workload. You would want
to "pin" to a particular version which is compatible with the version of Deno
you are using and has a fixed set of APIs you would expect. `https://deno.land/x/`
supports using git tags in the URL to direct you at a particular version. So to
use version 3.0.0 of oak, you would want to import
`https://deno.land/x/oak@v3.0.0/mod.ts`.

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

To provide an HTTPS server, then the `app.listen()` options need to include the
options `.secure` option set to `true` and supply a `.certFile` and a `.keyFile`
options as well.

An instance of application has some properties as well:

- `.keys`

  Keys to be used when signing and verifying cookies. The value can be set to
  an array of keys, and instance of `KeyStack`, or an object which provides the
  same interface as `KeyStack` (e.g. an instance of
  [keygrip](https://github.com/crypto-utils/keygrip)). If just the keys are
  passed, oak will manage the keys via `KeyStack` which allows easy key rotation
  without requiring re-signing of data values.

- `.proxy`

  This defaults to `false`, but can be set via the `Application` constructor
  options. This is intended to indicate the application is behind a proxy and
  will use `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For` when
  processing the request, which should provide more accurate information about
  the request.

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

- `.respond`

  Determines if when middleware finishes processing, the application should
  send the `.response` to the client. If `true` the response will be sent, and
  if `false` the response will not be send. The default is `true` but certain
  methods, like `.upgrade()` and `.sendEvents()` will set this to `false`.

- `.response`

  The `Response` object which will be used to form the response sent back to
  the requestor.

- `.socket`

  This will be `undefined` if the connection has not been upgraded to a web
  socket. If the connection has been upgraded, the `.socket` interface will
  be set.

- `.state`

  A record of application state, which can be strongly typed by specifying a
  generic argument when constructing an `Application()`, or inferred by passing
  a state object (e.g. `Application({ state })`).

The context passed to middleware has some methods:

- `.assert()`

  Makes an assertion, which if not true, throws an `HTTPError`, which subclass
  is identified by the second argument, with the message being the third
  argument.

- `.send()`

  Stream a file to the requesting client. See [Static content](#static-content)
  below for more information.

- `.sendEvents()`

  Convert the current connection into a server-sent event response and return
  a `ServerSentEventTarget` where messages and events can be streamed to the
  client. This will set `.respond` to `false`.

- `.throw()`

  Throws an `HTTPError`, which subclass is identified by the first argument,
  with the message being passed as the second.

- `.upgrade()`

  Attempt to upgrade the connection to a web socket connection, and resolve with
  an web socket interface. This will set `.respond` to `false`.

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

- `.secure`

  A shortcut for `.protocol`, returning `true` if HTTPS otherwise `false`.

- `.serverRequest`

  The original `net` server request.

- `.url`

  An instance of [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL)
  which is based on the full URL for the request. This is in place of having
  parts of the URL exposed on the rest of the request object.

And several methods:

- `.accepts(...types: string[])`

  Negotiates the content type supported by the request for the response. If no
  content types are passed, the method returns a prioritized array of accepted
  content types. If content types are passed, the best negotiated content type
  is returned. If there is no content type matched, then `undefined` is
  returned.

- `.acceptsCharsets(...charsets: string[])`

  Negotiates the character encoding supported by the request for the response.
  If no character encodings are passed, the method returns a prioritized array
  of accepted character encodings. If character encodings are passed, the best
  negotiated charset is returned. If there are no encodings matched, then
  `undefined` is returned.

  Most browsers simply to not send a character encoding header anymore, and it
  is just expected UTF-8 will be used.

- `.acceptsEncodings(...encodings: string[])`

  Negotiates the content encoding supported by the request for the response. If
  no encodings are passed, the method returns a prioritized array of accepted
  encodings. If encodings are passed, the best negotiated encoding is returned.
  If there are no encodings matched, then `undefined` is returned.

- `.acceptsLanguages(...languages: string[])`

  Negotiates the language the client is able to understand. Where a locale
  variant takes preference. If no encodings are passed, the method returns a
  prioritized array of understood languages. If languages are passed, the best
  negotiated language is returned. If there are no languages matched, then
  `undefined` is returned.

- `.body(options?: BodyOptions)`

  The method resolves to a version of the request body. Currently oak supports
  request body types of JSON, text and URL encoded form data. If the content
  type is missing, the request will be rejected with a 415 HTTP Error.

  When the option `asReader` is false or not passed, the method resolves with an
  object which contains a `type` property set to `"json"`, `"text"`, `"form"`,
  `"form-data"`, `"undefined"`, or `"raw"` and a `value` property set with the
  parsed value of the property. For JSON it will be the parsed value of the
  JSON string. For text, it will simply be a string and for a form, it will be
  an instance of `URLSearchParams`. For an undefined body, the value will be
  `undefined`. If the content type is not supported, the body will be returned
  with a `type` of `"raw"` and the `value` will be set to a `Uint8Array`
  containing the raw bytes for the request. If the application cannot handle
  the content type, it should throw a 415 HTTP Error.

  For multipart form data, the `value` property will be set to a
  `FormDataReader` interface which provides two methods to access the parts of
  the multipart form. There is `.read()` which will asynchronously resolve with
  an object containing the `.fields` property which is a record of key value
  pairs of the form data, and optionally a `.files` property which will be an
  array of files that were part of the multipart form. There is also
  `.stream()` which will asynchronously yield a tuple containing the name of
  the part, and the value of the part which is either a string or a
  `FormDataFile` object.

  When option `asReader` is true, the method resolves with an object who's
  `type` property is `"reader"` and who's `value` property is a `Deno.Reader`
  which is the HTTP server request's native response.

  You can use the option `contentTypes` to set additional media types that when
  present as the content type for the request, the body will be parsed
  accordingly. The options takes possibly four keys: `json`, `form`, `text`,
  and `raw`. For example if you wanted JavaScript sent to the server to be
  parsed as text, you would do something like this:

  ```ts
  app.use(async (ctx) => {
    const result = await ctx.request.body({
      contentTypes: {
        text: ["application/javascript"],
      },
    });
    result.type; // "text"
    result.value; // a string containing the text
  });
  ```

  In particular the `contentTypes.raw` can be used to override default types
  that are supported that you would want the middleware to handle itself. For
  example if you wanted the middleware to parse all text media types itself, you
  would do something like this:

  ```ts
  app.use(async (ctx) => {
    const result = await ctx.request.body({
      contentTypes: {
        raw: ["text"],
      },
    });
    result.type; // "raw"
    result.value; // a Uint8Array of all of the bytes read from the request
  });
  ```

#### Response

The `context.response` contains information about the response which will be
sent back to the requestor. It contains several properties:

- `.body`

  The body of the response, which can often be handled by the automatic response
  body handling documented below.

- `.headers`

  A `Headers` instance which contains the headers for the response.

- `.status`

  An HTTP `Status` code that will be sent back with the response. If this is
  not set before responding, oak will default to `200 OK` if there is a `.body`,
  otherwise `404 Not Found`.

- `.type`

  A media type or extension to set the `Content-Type` header for the response.
  For example, you can provide `txt` or `text/plain` to describe the body.

And a method:

- `.redirect(url?: string | URL | REDIRECT_BACK, alt?: string | URL)`

  A method to simplify redirecting the response to another URL. It will set
  the `Location` header to the supplied `url` and the status to `302 Found`
  (unless the status is already a `3XX` status). The use of symbol
  `REDIRECT_BACK` as the `url` indicates that the `Referrer` header in the
  request should be used as the direction, with the `alt` being the alternative
  location if the `Referrer` is not set. If neither the `alt` nor the
  `Referrer` are set, the redirect will occur to `/`. A basic HTML (if the
  requestor supports it) or a text body will be set explaining they are being
  redirected.

### Automatic response body handling

When the response `Content-Type` is not set in the headers of the `.response`,
oak will automatically try to determine the appropriate `Content-Type`. First
it will look at `.response.type`. If assigned, it will try to resolve the
appropriate media type based on treating the value of `.type` as either the
media type, or resolving the media type based on an extension. For example if
`.type` was set to `"html"`, then the `Content-Type` will be set to
`"text/html"`.

If `.type` is not set with a value, then oak will inspect the value of
`.response.body`. If the value is a `string`, then oak will check to see if
the string looks like HTML, if so, `Content-Type` will be set to `text/html`
otherwise it will be set to `text/plain`. If the value is an object, other
than a `Uint8Array`, a `Deno.Reader`, or `null`, the object will be passed to
`JSON.stringify()` and the `Content-Type` will be set to `application/json`.

If the type of body is a number, bigint or symbol, it will be coerced to a
string and treated as text.

If the value of body is a function, the function will be called with no
arguments. If the return value of the function is promise like, that will be
await, and the resolved value will be processed as above. If the value is not
promise like, it will be processed as above.

### Opening the server

The application method `.listen()` is used to open the server, start listening
for requests, and processing the registered middleware for each request. This
method returns a promise when the server closes.

Once the server is open, before it starts processing requests, the application
will fire a `"listen"` event, which can be listened for via the
`.addEventListener()` method. For example:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.addEventListener("listen", ({ hostname, port, secure }) => {
  console.log(
    `Listening on: ${secure ? "https://" : "http://"}${
      hostname ?? "localhost"
    }:${port}`
  );
});

// register some middleware

await app.listen({ port: 80 });
```

### Closing the server

If you want to close the application, the application supports the option of
an [abort signal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
Here is an example of using the signal:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

const controller = new AbortController();
const { signal } = controller;

// Add some middleware using `app.use()`

const listenPromise = app.listen({ port: 8000, signal });

// In order to close the sever...
controller.abort();

// Listen will stop listening for requests and the promise will resolve...
await listenPromise;
// and you can do something after the close to shutdown
```

### Error handling

Middleware can be used to handle other errors with middleware. Awaiting other
middleware to execute while trapping errors works. So if you had an error
handling middleware that provides a well managed response to errors would work
like this:

```ts
import {
  Application,
  isHttpError,
  Status,
} from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      switch (err.status) {
        case Status.NotFound:
          // handle NotFound
          break;
        default:
        // handle other statuses
      }
    } else {
      // rethrow if you can't handle the error
      throw err;
    }
  }
});
```

Uncaught middleware exceptions will be caught by the application. `Application`
extends the global `EventTarget` in Deno, and when uncaught errors occur in the
middleware or sending of responses, an `EventError` will be dispatched to the
application. To listen for these errors, you would add an event handler to the
application instance:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.addEventListener("error", (evt) => {
  // Will log the thrown error to the console.
  console.log(evt.error);
});

app.use((ctx) => {
  // Will throw a 500 on every request.
  ctx.throw(500);
});

await app.listen({ port: 80 });
```

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
  author: "Conan Doyle, Arthur",
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

const app = new Application();

app.use(async (context) => {
  await send(context, context.request.url.pathname, {
    root: `${Deno.cwd()}/examples/static`,
    index: "index.html",
  });
});

await app.listen({ port: 8000 });
```

## Helpers

The `mod.ts` also exports a variable named `helpers` which contains functions
that help with managing contexts.

### getQuery(ctx, options?)

The `helpers.getQuery()` function is designed to make it easier to determine
what a request might be querying in the middleware. It takes the supplied
context's `.request.url.searchParams` and converts it to a record object of the
keys and values. For example, it would convert the following request:

```
https://localhost/resource/?foo=bar&baz=qat
```

Into an object like this:

```js
{
  foo: "bar",
  baz: "qat"
}
```

The function can take a couple of options. The `asMap` will result in a `Map`
being returned instead of an object. The `mergeParams` will merge in parameters
that were parsed out of the route. This only works with router contexts, and
any params will be overwritten by the request's search params. If the following
URL was requested:

```
https://localhost/book/1234/page/23?page=32&size=24
```

And the following was the router middleware:

```ts
router.get("/book/:id/page/:page", (ctx) => {
  getQuery(ctx, { mergeParams: true });
});
```

Would result in the return value being:

```js
{
  id: "1234",
  page: "32",
  size: "24"
}
```

---

There are several modules that are directly adapted from other modules. They
have preserved their individual licenses and copyrights. All of the modules,
including those directly adapted are licensed under the MIT License.

All additional work is copyright 2018 - 2020 the oak authors. All rights
reserved.
