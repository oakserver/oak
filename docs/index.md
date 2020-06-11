# oak

A middleware framework for Deno's
[http](https://github.com/denoland/deno/tree/master/std/http#http) server,
including a router middleware.

This middleware framework is inspired by [Koa](https://github.com/koajs/koa)
and middleware router inspired by
[@koa/router](https://github.com/koajs/router/).

- [deno doc for oak](https://doc.deno.land/https/deno.land/x/oak/mod.ts)
- [Frequently Asked Questions](./FAQ)
- [Awesome oak](https://oakserver.github.io/awesome-oak/) - Community resources
  for oak.
- [oak_middleware](https://oakserver.github.io/middleware/) - A collection of
  middleware maintained by us.
- [Getting Started](#getting-started)
- [Server Sent Events](./sse)

## Getting started

Oak is designed with Deno in mind, and versions of oak are tagged for specific
versions of Deno in mind. In the examples here, we will be referring to using
oak off of `master`, though in practice you should _pin_ to a specific version
of oak in order to ensure compatibility.

For example if you wanted to use version 4.0.0 of oak, you would want to import
oak from `https://deno.land/x/oak@v4.0.0/mod.ts`.

All of the parts of oak that are intended to be used in creating a server are
exported from `mod.ts` and most of the time, you will simply want to import the
main class `Application` to create your server.

To create a very basic "hello world" server, you would want to create a
`server.ts` file with the following content:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello world!";
});

await app.listen("127.0.0.1:8000");
```

And then you would run the following command:

```shell
$ deno run --allow-net server.ts
```

If you aren't overly familiar with Deno, by default it has not trust for the
code you are running, and need you to let it have access to your machines
network, so `--allow-net` provides that.

When navigating on your local machine to `http://localhost:8000/` you should
see the `Hello world!` message in your browser.

## Middleware

The main architecture of middleware frameworks like oak is, unsurprisingly, the
concept of middleware. These are functions which are executed by the
application in a predictable order between when the application receives a
request and the response is sent.

Middleware functions allow you to break up the logic of your server into
discreet functions that encapsulate logic, as well as import in other
middleware that can add functionality to your application in a very loosely
coupled way.

To get an application to use a middleware function, an instance of an
application has a `.use()` method. Middleware functions are provided with two
parameters, a context object, and a `next()` function. Because the processing
of middleware is asynchronous by nature, middleware function can return a
promise to indicate when they are done processing.

### Control the execution of middleware

Middleware gets executed in the order that it is registered with the application
via the `.use()` method. Just executing the functions in order though is
insufficient in a lot of cases to create useful middleware. This is where the
`next()` function passed to a middleware function allows the function to
control the flow of other middleware, without the other middleware having to be
aware of it. `next()` indicates to the application that it should continue
executing other middleware in the chain. `next()` always returns a promise
which is resolved when the other middleware in the chain has resolved.

If you use `next()`, almost all the time you will want to `await next();` so
that the code in your middleware function executes as you expect. If you don't
await `next()` the rest of the code in your function will execute without all
the other middleware resolving, which is not usually what you want.

There are few scenarios where you want to control with your middleware. There
is when you want the middleware to do something just before the response is
sent, like logging middleware. You would want to create a middleware function
like this:

```ts
const app = new Application();

app.use(async (ctx, next) => {
  await next();
  /* Do some cool logging stuff here */
});
```

Here, you are signalling to the application to go ahead and run all the other
middleware, and when that is done, come back to this function and run the rest
of it.

Another scenario would be where there is a need to do some processing, typically
of the request, like checking if there is a valid session ID for a user, and
then allowing the rest of the middleware to run before finalising some things,
like maybe checking if the response needs to refresh the session ID. You would
want to create a middleware function like this:

```ts
app.use(async (ctx, next) => {
  /* Do some checking of the request */
  await next();
  /* Do some finalising of the response */
});
```

In situations where you want the rest of the middleware to run after a
function has run, or it isn't important what order the middleware runs in,
you could `await next()` before the end of your function, but that would be
unnecessary.

There is also the scenario where you might not want to hold up the sending of
a response while you perform other asynchronous operations. In this case you
could chose to simply not await `next()` or not return the promise related to
the asynchronous work from the function. This is a bit risky though, because
other middleware and even the application might behave in unexpected ways if
the middleware function makes incorrect assumptions about how the context
changes. You would want to make sure you understand the consequences of code
like that.

### Context

Each middleware function is passed a context when invoked. This context
represents "everything" that the middleware should know about the current
request and response that is being handled by the application. The context
also includes some other information that is useful for processing requests.
The properties of the context are:

- `.app`

  A reference to the application that is invoking the middleware.

- `.cookies`

  An interface to get and set cookies that abstracts the need to mediate between
  the request and response. If the `.keys` property has been set on the
  application, the cookies will be signed and verified automatically to help
  prevent with clients attempting to tamper with the keys.

- `.request`

  An interface to information about the request. This information is used to
  figure out what information is being requested and information about the
  capabilities of the client.

- `.response`

  An interface to information about what the server will respond with.

- `.state`

  An object that is "owned" by the application which is an easy way to persist
  information between requests. When using TypeScript this can be strongly
  typed to give structure to this state object.

There is also currently a couple methods available on context:

- `.assert()`

  Makes an assertion. If the assertion is not valid, throws and HTTP error
  based on the HTTP status code passed.

- `.throw()`

  Throws an HTTP error based on the HTTP status code passed as the first
  argument.
