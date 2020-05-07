# oak

A middleware framework for Deno's
[http](https://github.com/denoland/deno/tree/master/std/http#http) server,
including a router middleware.

This middleware framework is inspired by [Koa](https://github.com/koajs/koa)
and middleware router inspired by
[koa-router](https://github.com/alexmingoia/koa-router/).

## Getting started

Oak is designed with Deno in mind, and versions of oak are tagged for specific
versions of Deno in mind. In the examples here, we will be referring to using
oak off of `master`, though in practice you should _pin_ to a specific version
of oak in order to ensure compatibility.

For example if you wanted to use version 3.1.0 of oak, you would want to import
oak from `https://deno.land/x/oak@3.1.0/mod.ts`.

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

When navigating on your local machine to `http://localhost:8000/` you should
see the `Hello world!` message in your browser.
