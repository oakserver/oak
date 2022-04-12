# Frequently Asked Questions

## Where can I find full API documentation?

One of the advantages of Deno (and TypeScript) is that it is quite easy to
inline documentation in the code. The `doc.deno.land` site provides all the
documentation directly from the source code. The documentation for
[oak's mod.ts](https://doc.deno.land/https/deno.land/x/oak/mod.ts) contains all
the APIs that are considered "public". You can also get an output of the
documentation directly via `deno doc https://deno.land/x/oak/mod.ts` to your
console.

## Where is ctx.host, ctx.path, ctx.querystring, etc.?

Instead of creating "aliases" to lots of different parts of the requested URL,
oak provides a `ctx.request.url` which is a browser standard instance of
[`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) which contains all
of the parts of the requested URL in a single object.

## How do I close a server?

Oak uses the browser standard `AbortController` for closing a server. You pass
the `.signal` of the controller as one of the listen options, and you would then
`.abort()` on the controller when you want the server to close. For example:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

const controller = new AbortController();
const { signal } = controller;

app.use((ctx) => {
  // after first request, the server will be closed
  controller.abort();
});

await app.listen({ port: 8000, signal });
console.log("Server closed.");
```

## How to perform a redirect?

In the `ctx.response` call the `.redirect()` method. For example:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.redirect("https://deno.land/");
});

await app.listen({ port: 8000 });
```

The symbol `REDIRECT_BACK` can be used to redirect the requestor back to the to
the referrer (if the request's `Referer` header has been set), and the second
argument can be used to provide a "backup" if there is no referrer. For example:

```ts
import { Application, REDIRECT_BACK } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.redirect(REDIRECT_BACK, "/home");
});

await app.listen({ port: 8000 });
```

## How do I pass custom properties/state around?

The Application and the Context share an object property named `.state`. This is
designed for making custom application state available when processing requests.

It can also be strongly typed in TypeScript by using generics.

When a new context is created, by default the state of the application is
cloned, so effectively changes to the context's `.state` will only endure for
the lifetime of the request and response. There are other options for how the
state for the context is initialized, which can be set by setting the
`contextState` option when creating the application. Acceptable values are
`"clone"`, `"prototype"`, `"alias"`, `"empty"`. `"clone"` is the default and
clones the applications `.state` skipping any non-cloneable values like
functions and symbols. `"prototype"` uses the application's `.state` as the
prototype for the context `.state`, that means shallow property assignments on
the context's state only last for the lifetime of the context, but other changes
directly modify the shared state. `"alias"` means that the application's
`.state` and the context's `.state` are the same object. `"empty"` will
initialize the context's state with an empty object.

If you wanted to create middleware that set a user ID in requests, you would do
something like this:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

interface MyState {
  userId: number;
}

const app = new Application<MyState>();

app.use(async (ctx, next) => {
  // do whatever checks to determine the user ID
  ctx.state.userId = userId;
  await next();
  delete ctx.state.userId; // cleanup
});

app.use(async (ctx, next) => {
  // now the state.userId will be set for the rest of the middleware
  ctx.state.userId;
  await next();
});

await app.listen();
```

## I am seeing `[uncaught application error]` in the output, what is going on?

By default, `Application()` has a setting `logErrors` set to `true`. When this
is the case, any errors that are thrown in middleware and uncaught, or occur
outside the middleware (like some network errors) will result in a message being
logged.

Specifically error messages like
`Http - connection closed before message completed` can occur when responding to
requests where the connection drops before Deno has fully flushed the body. In
some network environments this is "normal", but neither Deno nor oak know that,
so the error gets surfaced. There maybe no way to avoid 100% of these errors,
and an application might want to respond to that (like clearing some sort of
state), therefore oak does not just "ignore" them, but provides them.

You can disabled automatic logging by setting `logErrors` to `false` in the
`Application` options. You can also use the
`.addEventListener("error", (evt) => {});` to register your own event handler for
uncaught errors.
