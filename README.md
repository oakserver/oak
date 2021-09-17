# oak

[![oak ci](https://github.com/oakserver/oak/workflows/ci/badge.svg)](https://github.com/oakserver/oak)
[![codecov](https://codecov.io/gh/oakserver/oak/branch/main/graph/badge.svg?token=KEKZ52NXGP)](https://codecov.io/gh/oakserver/oak)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/oak/mod.ts)

![Custom badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fdeno-visualizer.danopia.net%2Fshields%2Fdep-count%2Fx%2Foak%2Fmod.ts)
![Custom badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fdeno-visualizer.danopia.net%2Fshields%2Fupdates%2Fx%2Foak%2Fmod.ts)
[![Custom badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fdeno-visualizer.danopia.net%2Fshields%2Flatest-version%2Fx%2Foak%2Fmod.ts)](https://doc.deno.land/https/deno.land/x/oak/mod.ts)

A middleware framework for Deno's
[std http](https://doc.deno.land/https/deno.land/std/http/mod.ts) server, native
HTTP server and [Deno Deploy](https://deno.com/deploy). It also includes a
middleware router.

This middleware framework is inspired by [Koa](https://github.com/koajs/koa/)
and middleware router inspired by
[@koa/router](https://github.com/koajs/router/).

This README focuses on the mechanics of the oak APIs and is intended for those
who are familiar with JavaScript middleware frameworks like Express and Koa as
well as a decent understanding of Deno. If you aren't familiar with these,
please check out documentation on
[oakserver.github.io/oak](https://oakserver.github.io/oak/).

Also, check out our [FAQs](https://oakserver.github.io/oak/FAQ) and the
[awesome-oak](https://oakserver.github.io/awesome-oak/) site of community
resources.

> ⚠️ _Warning_ The examples in this README pull from `main`, which may not make
> sense to do when you are looking to actually deploy a workload. You would want
> to "pin" to a particular version which is compatible with the version of Deno
> you are using and has a fixed set of APIs you would expect.
> `https://deno.land/x/` supports using git tags in the URL to direct you at a
> particular version. So to use version 3.0.0 of oak, you would want to import
> `https://deno.land/x/oak@v3.0.0/mod.ts`.

## Application, middleware, and context

The `Application` class wraps the `serve()` function from the `http` package. It
has two methods: `.use()` and `.listen()`. Middleware is added via the `.use()`
method and the `.listen()` method will start the server and start processing
requests with the registered middleware.

A basic usage, responding to every request with _Hello World!_:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

await app.listen({ port: 8000 });
```

You would then run this script in Deno like:

```
> deno run --allow-net helloWorld.ts
```

For more information on running code under Deno, or information on how to
install the Deno CLI, check out the [Deno manual](https://deno.land/manual).

The middleware is processed as a stack, where each middleware function can
control the flow of the response. When the middleware is called, it is passed a
context and reference to the "next" method in the stack.

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

  Keys to be used when signing and verifying cookies. The value can be set to an
  array of keys, and instance of `KeyStack`, or an object which provides the
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

  Determines if when middleware finishes processing, the application should send
  the `.response` to the client. If `true` the response will be sent, and if
  `false` the response will not be sent. The default is `true` but certain
  methods, like `.upgrade()` and `.sendEvents()` will set this to `false`.

- `.response`

  The `Response` object which will be used to form the response sent back to the
  requestor.

- `.socket`

  This will be `undefined` if the connection has not been upgraded to a web
  socket. If the connection has been upgraded, the `.socket` interface will be
  set.

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

  Convert the current connection into a server-sent event response and return a
  `ServerSentEventTarget` where messages and events can be streamed to the
  client. This will set `.respond` to `false`.

- `.throw()`

  Throws an `HTTPError`, which subclass is identified by the first argument,
  with the message being passed as the second.

- `.upgrade()`

  Attempt to upgrade the connection to a web socket connection, and resolve with
  a `WebSocket` interface. Previously this would be a Deno `std` library web
  socket but now is the web standard `WebSocket`. This will set `.respond` to
  `false`.

Unlike other middleware frameworks, `context` does not have a significant amount
of aliases. The information about the request is only located in `.request` and
the information about the response is only located in `.response`.

#### Cookies

The `context.cookies` allows access to the values of cookies in the request, and
allows cookies to be set in the response. It automatically secures cookies if
the `.keys` property is set on the application. Because `.cookies` uses the web
crypto APIs to sign and validate cookies, and those APIs work in an asynchronous
way, the cookie APIs work in an asynchronous way. It has several methods:

- `.get(key: string, options?: CookieGetOptions): Promise<string | undefined>`

  Attempts to retrieve the cookie out of the request and returns the value of
  the cookie based on the key. If the applications `.keys` is set, then the
  cookie will be verified against a signed version of the cookie. If the cookie
  is valid, the promise will resolve with the value. If it is invalid, the
  cookie signature will be set to deleted on the response. If the cookie was not
  signed by the current key, it will be resigned and added to the response.

- `.set(key: string, value: string, options?: CookieSetDeleteOptions): Promise<void>`

  Will set a cookie in the response based on the provided key, value and any
  options. If the applications `.keys` is set, then the cookie will be signed
  and the signature added to the response. As the keys are signed
  asynchronously, awaiting the `.set()` method is advised.

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

  The method returns a representation of the request body. When no options are
  passed, the request headers are used to determine the type of the body, which
  will be parsed and returned. The returned object contains two properties.
  `type` contains the type of `"json"`, `"text"`, `"form"`, `"form-data"`,
  `"bytes"` or `"undefined"`.

  The type of the `value` can be determined by the value of the `type` property:

  | `type`        | `value`                      |
  | ------------- | ---------------------------- |
  | `"bytes"`     | `Promise<Uint8Array>`        |
  | `"form"`      | `Promise<URLSearchParams>`   |
  | `"form-data"` | `FormDataReader`             |
  | `"json"`      | `Promise<unknown>`           |
  | `"reader"`    | `Deno.Reader`                |
  | `"stream"`    | `ReadableStream<Uint8Array>` |
  | `"text"`      | `Promise<string>`            |
  | `"undefined"` | `undefined`                  |

  If there is no body, the `type` of `"undefined"` is returned. If the content
  type of the request is not recognised, then the `type` of `"bytes"` is
  returned.

  You can use the option `type` to specifically request the body to be returned
  in a particular format. If you need access to the Deno HTTP server's body,
  then you can use the `type` of `"reader"` which will return the body object of
  type `"reader"` with a `value` as a `Deno.Reader`:

  ```ts
  import { readAll } from "https://deno.land/x/std/io/util.ts";

  app.use(async (ctx) => {
    const result = ctx.request.body({ type: "reader" });
    result.type; // "reader"
    await readAll(result.value); // a "raw" Uint8Array of the body
  });
  ```

  Another use case for the `type` option is if certain middleware always needs
  the body in a particular format, but wants other middleware to consume it in a
  content type resolved way:

  ```ts
  app.use(async (ctx) => {
    if (ctx.request.hasBody) {
      const result = ctx.request.body({ type: "text" });
      const text = await result.value;
      // do some validation of the body as a string
    }
  });

  app.use(async (ctx) => {
    const result = ctx.request.body(); // content type automatically detected
    if (result.type === "json") {
      const value = await result.value; // an object of parsed JSON
    }
  });
  ```

  When specifying a `type`, it is always good to check that `.request.hasBody`
  is `true`, as the `.request.body()` will throw if the body is undefined.

  You can use the option `contentTypes` to set additional media types that when
  present as the content type for the request, the body will be parsed
  accordingly. The options takes possibly five keys: `json`, `form`, `formData`,
  `text`, and `bytes`. For example if you wanted JavaScript sent to the server
  to be parsed as text, you would do something like this:

  ```ts
  app.use(async (ctx) => {
    const result = ctx.request.body({
      contentTypes: {
        text: ["application/javascript"],
      },
    });
    result.type; // "text"
    await result.value; // a string containing the text
  });
  ```

  Because of the nature of how the body is parsed, once the body is requested
  and returned in a particular format, it can't be requested in certain other
  ones, and `.request.body()` will throw if an incompatible type is requested.
  The types `"form-data"`, `"reader"` and `"stream"` are incompatible with each
  other and all other types, while `"json"`, `"form"`, `"bytes"`, `"text"` are
  all compatible with each other. Although, if there are invalid data for that
  type, they may throw if coerced into that type.

  In particular the `contentTypes.bytes` can be used to override default types
  that are supported that you would want the middleware to handle itself. For
  example if you wanted the middleware to parse all text media types itself, you
  would do something like this:

  ```ts
  app.use(async (ctx) => {
    const result = ctx.request.body({
      contentTypes: {
        bytes: ["text"],
      },
    });
    result.type; // "bytes"
    await result.value; // a Uint8Array of all of the bytes read from the request
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

  An HTTP `Status` code that will be sent back with the response. If this is not
  set before responding, oak will default to `200 OK` if there is a `.body`,
  otherwise `404 Not Found`.

- `.type`

  A media type or extension to set the `Content-Type` header for the response.
  For example, you can provide `txt` or `text/plain` to describe the body.

And a method:

- `.redirect(url?: string | URL | REDIRECT_BACK, alt?: string | URL)`

  A method to simplify redirecting the response to another URL. It will set the
  `Location` header to the supplied `url` and the status to `302 Found` (unless
  the status is already a `3XX` status). The use of symbol `REDIRECT_BACK` as
  the `url` indicates that the `Referer` header in the request should be used as
  the direction, with the `alt` being the alternative location if the `Referer`
  is not set. If neither the `alt` nor the `Referer` are set, the redirect will
  occur to `/`. A basic HTML (if the requestor supports it) or a text body will
  be set explaining they are being redirected.

### Automatic response body handling

When the response `Content-Type` is not set in the headers of the `.response`,
oak will automatically try to determine the appropriate `Content-Type`. First it
will look at `.response.type`. If assigned, it will try to resolve the
appropriate media type based on treating the value of `.type` as either the
media type, or resolving the media type based on an extension. For example if
`.type` was set to `"html"`, then the `Content-Type` will be set to
`"text/html"`.

If `.type` is not set with a value, then oak will inspect the value of
`.response.body`. If the value is a `string`, then oak will check to see if the
string looks like HTML, if so, `Content-Type` will be set to `text/html`
otherwise it will be set to `text/plain`. If the value is an object, other than
a `Uint8Array`, a `Deno.Reader`, or `null`, the object will be passed to
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
    `Listening on: ${secure ? "https://" : "http://"}${hostname ??
      "localhost"}:${port}`,
  );
});

// register some middleware

await app.listen({ port: 80 });
```

### Closing the server

If you want to close the application, the application supports the option of an
[abort signal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
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

### Deno `std/http` versus native bindings

As of Deno 1.9, Deno has a _native_ HTTP server. oak automatically detects if
these APIs are available and will listen and process requests using the native
server. Currently the APIs are marked as _unstable_ so in order to use them, you
need to start your server with the `--unstable` flag. For example:

```
> deno run --allow-net --unstable server.ts
```

#### Overriding the HTTP server

If you wish to not utilise the default behavior of detecting the capability, you
can force the server during application creation. For example to force the
`std/http` server, you would do the following:

```ts
import { Application, HttpServerStd } from "https://deno.land/x/oak/mod.ts";

const app = new Application({
  serverConstructor: HttpServerStd,
});
```

Of if you wanted to force the native:

```ts
import { Application, HttpServerNative } from "https://deno.land/x/oak/mod.ts";

const app = new Application({
  serverConstructor: HttpServerNative,
});
```

### Just handling requests

In situations where you don't want the application to listen for requests on the
`std/http/server`, but you still want the application to process requests, you
can use the `.handle()` method. For example if you are in a serverless function
where the requests are arriving in a different way.

The `.handle()` method will invoke the middleware, just like the middleware gets
invoked for each request that is processed by `.listen()`. The method works with
either `std/http` requests/responses, or it handles the _native_ Deno responses.

#### Handling _native_ or Deploy requests and responses

When using the native/Deploy requests, the `.handle()` method accepts up to
three arguments. The first being a
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) argument,
and the second being a `Deno.Conn` argument. The third optional argument is a
flag to indicate if the request was "secure" in the sense it originated from a
TLS connection to the remote client. The method resolved with a
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object
or `undefined` if the `ctx.respond === true`.

An example:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

const listener = Deno.listen({ hostname: "localhost", port: 8000 });

for await (const conn of listener) {
  (async () => {
    const requests = Deno.serveHttp(conn);
    for await (const { request, respondWith } of requests) {
      const response = await app.handle(request, conn);
      if (response) {
        respondWith(response);
      }
    }
  });
}
```

#### Handling `std/http` requests and responses

When using `std/http` requests the `.handle()` method accepts up to two
arguments, one being the request which conforms to the `std/http/server`'s
`ServerRequest` interface and an optional second argument which is if the
request is "secure" in the sense it originated from a TLS connection to the
remote client. The method resolves with a response that conforms to the
`ServerResponse` interface (which can be used with the `std/http/server`'s
`request.respond()` method) or `undefined` if the `ctx.respond === true` (e.g.
the connection was upgraded to a web socket or is sending back server sent
events).

An example:

```ts
import { listenAndServe } from "https://deno.land/std/http/server.ts";
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

await listenAndServe({ port: 8000 }, async (request) => {
  const response = await app.handle(request);
  if (response) {
    request.respond(response);
  }
});
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

A route passed is converted to a regular expression using
[path-to-regexp](https://github.com/pillarjs/path-to-regexp), which means
parameters expressed in the pattern will be converted. `path-to-regexp` has
advanced usage which can create complex patterns which can be used for matching.
Check out the
[documentation for that library](https://github.com/pillarjs/path-to-regexp#parameters)
if you have advanced use cases.

### Nested routers

Nesting routers is supported. The following example responds to
`http://localhost:8000/forums/oak/posts` and
`http://localhost:8000/forums/oak/posts/nested-routers`.

```typescript
import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const posts = new Router()
  .get("/", (ctx) => {
    ctx.response.body = `Forum: ${ctx.params.forumId}`;
  })
  .get("/:postId", (ctx) => {
    ctx.response.body =
      `Forum: ${ctx.params.forumId}, Post: ${ctx.params.postId}`;
  });

const forums = new Router()
  .use("/forums/:forumId/posts", posts.routes(), posts.allowedMethods());

await new Application()
  .use(forums.routes())
  .listen({ port: 8000 });
```

## Static content

The function `send()` is designed to serve static content as part of a
middleware function. In the most straight forward usage, a root is provided and
requests provided to the function are fulfilled with files from the local file
system relative to the root from the requested path.

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

`send()` automatically supports features like providing `ETag` and
`Last-Modified` headers in the response as well as processing `If-None-Match`
and `If-Modified-Since` headers in the request. This means when serving up
static content, clients will be able to rely upon their cached versions of
assets instead of re-downloading them.

### ETag support

The `send()` method automatically supports generating an `ETag` header for
static assets. The header allows the client to determine if it needs to
re-download an asset or not, but it can be useful to calculate `ETag`s for other
scenarios, and oak supplies the `etag` object to provide these functions.

There are two main use cases, first, a middleware function that assesses the
`context.reponse.body` and determines if it can create an `ETag` header for that
body type, and if so sets the `ETag` header on the response. Basic usage would
look something like this:

```ts
import { Application, etag } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use(etag.factory());

// ... other middleware for the application
```

The second use case is lower-level, where you have an entity which you want to
calculate an `ETag` value for, like implementing custom response logic based on
other header information. The `etag.calculate()` method is provided for this,
and it supports calculating `ETag`s for `string`s, `Uint8Array`s, and
`Deno.FileInfo` structures. Basic usage would look something like this:

```ts
import { etag } from "https://deno.land/x/oak/mod.ts";

export async function mw(context, next) {
  await next();
  const value = etag.calculate("hello deno");
  context.response.headers.set("ETag", value);
}
```

By default, `etag` will calculate weak tags for `Deno.FileInfo` (or `Deno.File`
bodies in the middleware) and strong tags for `string`s and `Uint8Array`s. This
can be changed by passing a `weak` property in the `options` parameter to either
the `factory` or `calculate` methods.

There are also two helper functions which can be used in conjunction with
requests. There is `ifNoneMatch()` and `ifMatch()`. Both take the value of a
header and an entity to compare to.

`ifNoneMatch()` validates if the entities `ETag` doesn't match the supplied
tags, while `ifMatch()` does the opposite. Check out MDN's
[`If-None-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
and
[`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)
header articles for more information how these headers are used with `ETag`s.

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
that were parsed out of the route. This only works with router contexts, and any
params will be overwritten by the request's search params. If the following URL
was requested:

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

## Testing

The `mod.ts` exports an object named `testing` which contains some utilities for
testing oak middleware you might create. See the
[Testing with oak](https://oakserver.github.io/oak/testing) for more
information.

---

There are several modules that are directly adapted from other modules. They
have preserved their individual licenses and copyrights. All of the modules,
including those directly adapted are licensed under the MIT License.

All additional work is copyright 2018 - 2021 the oak authors. All rights
reserved.
