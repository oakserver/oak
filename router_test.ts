// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import {
  assert,
  assertEquals,
  assertStrictEq,
  assertThrowsAsync,
  test,
} from "./test_deps.ts";
import { Application } from "./application.ts";
import { Context } from "./context.ts";
import { Status } from "./deps.ts";
import { httpErrors } from "./httpError.ts";
import { Router, RouterContext } from "./router.ts";
import { Next } from "./middleware.ts";

function createMockApp<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  state = {} as S,
): Application<S> {
  const app = {
    state,
    use() {
      return app;
    },
  };
  return app as any;
}

function createMockContext<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  app: Application<S>,
  path = "/",
  method = "GET",
) {
  const headers = new Headers();
  return ({
    app,
    request: {
      headers: new Headers(),
      method,
      url: new URL(path, "https://localhost/"),
    },
    response: {
      status: undefined,
      body: undefined,
      redirect(url: string | URL) {
        headers.set("Location", encodeURI(String(url)));
      },
      headers,
    },
    state: app.state,
  } as unknown) as Context<S>;
}

function createMockNext() {
  return async function next() {
    return new Next();
  };
}

function setup<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  path = "/",
  method = "GET",
): {
  app: Application<S>;
  context: Context<S>;
  next: () => Promise<Next>;
} {
  const app = createMockApp<S>();
  const context = createMockContext<S>(app, path, method);
  const next = createMockNext();
  return { app, context, next };
}

test({
  name: "router empty routes",
  async fn() {
    const { context, next } = setup();

    const router = new Router();
    const mw = router.routes();
    assert(await mw(context, next) instanceof Next);
  },
});

test({
  name: "router get single match",
  async fn() {
    const { app, context, next } = setup("/", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.get("/", (context, next) => {
      assertStrictEq(context.router, router);
      assertStrictEq(context.app, app);
      callStack.push(1);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [1]);
  },
});

test({
  name: "router match single param",
  async fn() {
    const { context, next } = setup("/foo/bar", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.get("/", (context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/foo", (context, next) => {
      callStack.push(2);
      return next();
    });
    router.get<{ id: string }>("/foo/:id", (context, next) => {
      callStack.push(3);
      assertEquals(context.params.id, "bar");
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [3]);
  },
});

test({
  name: "router match with next",
  async fn() {
    const { context, next } = setup("/foo", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.get("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(3);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [2, 3]);
  },
});

test({
  name: "router match delete",
  async fn() {
    const { context, next } = setup("/", "DELETE");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.delete("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/", (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.head("/", (_context, next) => {
      callStack.push(3);
      return next();
    });
    router.options("/", (_context, next) => {
      callStack.push(4);
      return next();
    });
    router.patch("/", (_context, next) => {
      callStack.push(5);
      return next();
    });
    router.post("/", (_context, next) => {
      callStack.push(6);
      return next();
    });
    router.put("/", (_context, next) => {
      callStack.push(7);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 1]);
  },
});

test({
  name: "router match get",
  async fn() {
    const { context, next } = setup("/", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.delete("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/", (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.head("/", (_context, next) => {
      callStack.push(3);
      return next();
    });
    router.options("/", (_context, next) => {
      callStack.push(4);
      return next();
    });
    router.patch("/", (_context, next) => {
      callStack.push(5);
      return next();
    });
    router.post("/", (_context, next) => {
      callStack.push(6);
      return next();
    });
    router.put("/", (_context, next) => {
      callStack.push(7);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 2]);
  },
});

test({
  name: "router match head",
  async fn() {
    const { context, next } = setup("/", "HEAD");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.delete("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.head("/", (_context, next) => {
      callStack.push(3);
      return next();
    });
    router.get("/", (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.options("/", (_context, next) => {
      callStack.push(4);
      return next();
    });
    router.patch("/", (_context, next) => {
      callStack.push(5);
      return next();
    });
    router.post("/", (_context, next) => {
      callStack.push(6);
      return next();
    });
    router.put("/", (_context, next) => {
      callStack.push(7);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 3, 2]);
  },
});

test({
  name: "router match options",
  async fn() {
    const { context, next } = setup("/", "OPTIONS");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.delete("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/", (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.head("/", (_context, next) => {
      callStack.push(3);
      return next();
    });
    router.options("/", (_context, next) => {
      callStack.push(4);
      return next();
    });
    router.patch("/", (_context, next) => {
      callStack.push(5);
      return next();
    });
    router.post("/", (_context, next) => {
      callStack.push(6);
      return next();
    });
    router.put("/", (_context, next) => {
      callStack.push(7);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [4]);
  },
});

test({
  name: "router match patch",
  async fn() {
    const { context, next } = setup("/", "PATCH");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.delete("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/", (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.head("/", (_context, next) => {
      callStack.push(3);
      return next();
    });
    router.options("/", (_context, next) => {
      callStack.push(4);
      return next();
    });
    router.patch("/", (_context, next) => {
      callStack.push(5);
      return next();
    });
    router.post("/", (_context, next) => {
      callStack.push(6);
      return next();
    });
    router.put("/", (_context, next) => {
      callStack.push(7);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [5]);
  },
});

test({
  name: "router match post",
  async fn() {
    const { context, next } = setup("/", "POST");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.delete("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/", (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.head("/", (_context, next) => {
      callStack.push(3);
      return next();
    });
    router.options("/", (_context, next) => {
      callStack.push(4);
      return next();
    });
    router.patch("/", (_context, next) => {
      callStack.push(5);
      return next();
    });
    router.post("/", (_context, next) => {
      callStack.push(6);
      return next();
    });
    router.put("/", (_context, next) => {
      callStack.push(7);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 6]);
  },
});

test({
  name: "router match put",
  async fn() {
    const { context, next } = setup("/", "PUT");

    const callStack: number[] = [];
    const router = new Router();
    router.all("/", async (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.delete("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/", (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.head("/", (_context, next) => {
      callStack.push(3);
      return next();
    });
    router.options("/", (_context, next) => {
      callStack.push(4);
      return next();
    });
    router.patch("/", (_context, next) => {
      callStack.push(5);
      return next();
    });
    router.post("/", (_context, next) => {
      callStack.push(6);
      return next();
    });
    router.put("/", (_context, next) => {
      callStack.push(7);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 7]);
  },
});

test({
  name: "router patch prefix",
  async fn() {
    const { context, next } = setup("/route1/action1", "GET");
    const callStack: number[] = [];
    const router = new Router({ prefix: "/route1" });
    router.get("/action1", (_context, next) => {
      callStack.push(0);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0]);
  },
});

test({
  name: "router match strict",
  async fn() {
    const { context, next } = setup("/route", "GET");
    const callStack: number[] = [];
    const router = new Router({ strict: true });
    router.get("/route", (_context, next) => {
      callStack.push(0);
      return next();
    });
    router.get("/route/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0]);
  },
});

test({
  name: "router as iterator",
  fn() {
    const router = new Router();
    router.all("/route", (_context, next) => next());
    router.delete("/route/:id", (_context, next) => next());
    router.patch("/route/:id", (_context, next) => next());
    const routes = [...router];
    assertEquals(routes.length, 3);
    assertEquals(routes[0].path, "/route");
    assertEquals(routes[0].methods, ["HEAD", "DELETE", "GET", "POST", "PUT"]);
    assertEquals(routes[0].middleware.length, 1);
  },
});

test({
  name: "route throws",
  async fn() {
    const { context, next } = setup();
    const router = new Router();
    router.all("/", (ctx, next) => {
      ctx.throw(404);
      return next();
    });
    const mw = router.routes();
    await assertThrowsAsync(async () => {
      await mw(context, next);
    });
  },
});

test({
  name: "router prefix, default route",
  async fn() {
    const { context, next } = setup("/foo");
    let called = 0;
    const router = new Router({
      prefix: "/foo",
    });
    router.all("/", (_context, next) => {
      called++;
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(called, 1);
  },
});

test({
  name: "router redirect",
  async fn() {
    const { context, next } = setup("/foo");
    const router = new Router();
    router.redirect("/foo", "/bar");
    const mw = router.routes();
    await mw(context, next);
    assertEquals(context.response.status, Status.Found);
    assertEquals(context.response.headers.get("Location"), "/bar");
  },
});

test({
  name: "router redirect, 301 Moved Permanently",
  async fn() {
    const { context, next } = setup("/foo");
    const router = new Router();
    router.redirect("/foo", "/bar", Status.MovedPermanently);
    const mw = router.routes();
    await mw(context, next);
    assertEquals(context.response.status, Status.MovedPermanently);
    assertEquals(context.response.headers.get("Location"), "/bar");
  },
});

test({
  name: "router param middleware",
  async fn() {
    const { context, next } = setup("/book/1234/price");
    const router = new Router<{ id: string }>();
    const callStack: string[] = [];
    router.param("id", (param, ctx, next) => {
      callStack.push("param");
      assertEquals(param, "1234");
      assertEquals(ctx.params.id, "1234");
      return next();
    });
    router.all("/book/:id/price", (ctx, next) => {
      callStack.push("all");
      assertEquals(ctx.params.id, "1234");
      return next();
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, ["param", "all"]);
  },
});

test({
  name: "router allowedMethods() OPTIONS",
  async fn() {
    const { context, next } = setup("/foo", "OPTIONS");
    const router = new Router();
    router.put("/foo", (_ctx, next) => {
      return next();
    });
    router.patch("/foo", (_ctx, next) => {
      return next();
    });
    const routes = router.routes();
    const mw = router.allowedMethods();
    await routes(context, next);
    await mw(context, next);
    assertEquals(context.response.status, Status.OK);
    assertEquals(context.response.headers.get("Allowed"), "PUT, PATCH");
  },
});

test({
  name: "router allowedMethods() Not Implemented",
  async fn() {
    const { context, next } = setup("/foo", "PATCH");
    const router = new Router({ methods: ["GET"] });
    router.get("/foo", (_ctx, next) => {
      return next();
    });
    const routes = router.routes();
    const mw = router.allowedMethods();
    await routes(context, next);
    await mw(context, next);
    assertEquals(context.response.status, Status.NotImplemented);
  },
});

test({
  name: "router allowedMethods() Method Not Allowed",
  async fn() {
    const { context, next } = setup("/foo", "PUT");
    const router = new Router();
    router.get("/foo", (_ctx, next) => {
      return next();
    });
    const routes = router.routes();
    const mw = router.allowedMethods();
    await routes(context, next);
    await mw(context, next);
    assertEquals(context.response.status, Status.MethodNotAllowed);
  },
});

test({
  name: "router allowedMethods() throws Not Implemented",
  async fn() {
    const { context, next } = setup("/foo", "PATCH");
    const router = new Router({ methods: ["GET"] });
    router.get("/foo", (_ctx, next) => {
      return next();
    });
    const routes = router.routes();
    const mw = router.allowedMethods({ throw: true });
    await routes(context, next);
    await assertThrowsAsync(async () => {
      await mw(context, next);
    }, httpErrors.NotImplemented);
  },
});

test({
  name: "router allowedMethods() throws Method Not Allowed",
  async fn() {
    const { context, next } = setup("/foo", "PUT");
    const router = new Router();
    router.get("/foo", (_ctx, next) => {
      return next();
    });
    const routes = router.routes();
    const mw = router.allowedMethods({ throw: true });
    await routes(context, next);
    await assertThrowsAsync(async () => {
      await mw(context, next);
    }, httpErrors.MethodNotAllowed);
  },
});

test({
  name: "router named route - get URL",
  fn() {
    const router = new Router<{ id: string }>();
    router.get("get_book", "/book/:id", (ctx, next) => next());
    assertEquals(router.url("get_book", { id: "1234" }), "/book/1234");
    assertEquals(
      router.url("get_book", { id: "1234" }, { query: { sort: "ASC" } }),
      "/book/1234?sort=ASC",
    );
  },
});

test({
  name: "router types",
  fn() {
    const app = createMockApp<{ id: string }>();
    const router = new Router();

    app.use(
      router.get(
        "/:id",
        (ctx: RouterContext<{ id: string }, { session: number }>, next) => {
          ctx.params.id;
          ctx.state.session;
          return next();
        },
      ).get("/:id/names", (ctx, next) => {
        ctx.params.id;
        ctx.state.session;
        return next();
      }).put("/:page", (ctx: RouterContext<{ page: string }>, next) => {
        ctx.params.page;
        return next();
      }).put("/value", (ctx, next) => {
        ctx.params.id;
        ctx.params.page;
        ctx.state.session;
        // @ts-expect-error
        ctx.params.foo;
        return next();
      }).routes(),
    ).use((ctx, next) => {
      ctx.state.id;
      return next();
    });
  },
});

test({
  name: "middleware returned from router.routes() passes next",
  async fn() {
    const { context } = setup("/foo", "GET");

    const callStack: number[] = [];

    async function next() {
      callStack.push(4);
      return new Next();
    }

    const router = new Router();
    router.get("/", (_context, next) => {
      callStack.push(1);
      return next();
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(2);
      return next();
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(3);
      return next();
    });

    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [2, 3, 4]);
  },
});
