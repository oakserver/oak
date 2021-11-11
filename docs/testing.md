# Testing

Unit testing your middleware can be challenging, especially if you have to open
up a network port and send requests into an application just to see if your
middleware responds as expected.

To help with this, oak exposes its internal mocking library as part of the
public API.

The testing utilities are exported from the `/mod.ts` under a `testing`
namespace. To import the namespace, you would want to import it like:

```ts
import { testing } from "https://deno.land/x/oak/mod.ts";
```

## Usage

The most common usage would be creating a mock context, which would include a
request and response, and then using that context to call your middleware, and
then making assertions against the result of that middleware.

In the following example, we will create a middleware that checks if the request
path is `"/a"` and if so, sets the body and a header in the response:

```ts
import { testing } from "https://deno.land/x/oak/mod.ts";
import type { Middleware } from "https://deno.land/x/oak/mod.ts";
import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";

const mw: Middleware = async (ctx, next) => {
  await next();
  if (ctx.request.url.pathname === "/a") {
    ctx.response.body = "Hello a";
    ctx.response.headers.set("x-hello-a", "hello");
  }
};

Deno.test({
  name: "example test",
  async fn() {
    const ctx = testing.createMockContext({
      path: "/a",
    });
    const next = testing.createMockNext();

    await mw(ctx, next);

    assertEquals(ctx.response.body, "Hello a");
    assert(ctx.response.headers.has("x-hello-a"));
  },
});
```

## createMockApp()

This creates a mock application which takes a single optional argument of
`state` which represents the state of the application.

## createMockContext()

This creates a mock context. This is the most useful feature of the library and
accepts a set of options that adhere to this interface:

```ts
export interface MockContextOptions<
  P extends RouteParams = RouteParams,
  S extends State = Record<string, any>,
> {
  app?: Application<S>;
  method?: string;
  params?: P;
  path?: string;
  state?: S;
}
```

The function generates a mock that can either be used as a regular `Context` or
as a `RouterContext`.

## createMockNext()

This creates a `next()` function which can be used when calling middleware.
