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
the `.signal` of the controller as one of the listen options, and you would
then `.abort()` on the controller when you want the server to close. For
example:

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

## How to get access to the "raw" request body?

When requesting a body, use `await ctx.request.body({ asReader: true })`. This
will resolve with the
[`Deno.Reader`](https://doc.deno.land/https/github.com/denoland/deno/releases/latest/download/lib.deno.d.ts#Deno.Reader)
interface in the `value` property of the response. You can then read from this
interface the "raw" body content.

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
the referrer (if the request's `Referrer` header has been set), and the second
argument can be used to provide a "backup" if there is no referrer. For example:

```ts
import { Application, REDIRECT_BACK } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.redirect(REDIRECT_BACK, "/home");
});

await app.listen({ port: 8000 });
```
