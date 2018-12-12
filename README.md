# oak

[![][tci badge]][tci link]

A middleware framework for Deno's [net](https://github.com/denoland/net)
server, including a router middleware.

This middleware framework is inspired by [Koa](https://github.com/koajs/koa)
but it takes a more strict concept of not duplicating information in more than
one location when it comes to requests and responses.

**Note: This is currently a minimum viable framework, versus something that has
a mature API**

## Application, Middleware, and Context

The `Application` class wraps the `serve()` function from the `net` package. It
has two methods: `.use()` and `.listen()`. Middleware is added via the
`.use()` method and the `.listen()` method will start the server and start
processing requests with the registered middleware.

A basic usage, responding to every request with _Hello World!_:

```ts
import { Application } from "https://deno.land/x/oak/main.ts";

(async () => {
  const app = new Application();

  app.use(ctx => {
    ctx.response.body = "Hello World!";
  });

  await app.listen("0.0.0.0:8000");
})();
```

The middleware is processed as a stack, where each middleware function can
control the flow of the response. When the middleware is called, it is passed
a context and reference to the "next" method in the stack.

A more complex example:

```ts
import { Application } from "https://deno.land/x/oak/main.ts";

(async () => {
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
})();
```

## Router

_TBC_

---

Licensed under the MIT License.

Copyright 2018 — Kitson P. Kelly — All right reserved.

[tci badge]: https://travis-ci.com/kitsonk/colors.svg?branch=master
[tci link]: https://travis-ci.com/kitsonk/colors
