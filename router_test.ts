// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file

import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "./test_deps.ts";
import type { Application } from "./application.ts";
import type { Context } from "./context.ts";
import { errors, Status } from "./deps.ts";
import { Router, RouterContext } from "./router.ts";

const { test } = Deno;

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
  return async function next() {};
}

function setup<
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  path = "/",
  method = "GET",
): {
  app: Application<S>;
  context: Context<S>;
  next: () => Promise<void>;
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
    assertEquals(await mw(context, next), undefined);
  },
});

test({
  name: "router accepts non-void middleware",
  fn() {
    const router = new Router();
    router.get("/", (ctx) => ctx.response.body = "hello oak");
  },
});

test({
  name: "router get single match",
  async fn() {
    const { app, context, next } = setup("/", "GET");

    const callStack: number[] = [];
    const router = new Router();
    router.get("/", (context) => {
      assertStrictEquals(context.router, router);
      assertStrictEquals(context.app, app);
      callStack.push(1);
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
    router.get("/", (context) => {
      callStack.push(1);
    });
    router.get("/foo", (context) => {
      callStack.push(2);
    });
    router.get("/foo/:id", (context) => {
      callStack.push(3);
      assertEquals(context.params.id, "bar");
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
    router.get("/", (_context) => {
      callStack.push(1);
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(2);
      await next();
    });
    router.get("/foo", () => {
      callStack.push(3);
    });
    router.get("/foo", () => {
      callStack.push(4);
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
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
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
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
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
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0, 3]);
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
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
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
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
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
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
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
      await next();
    });
    router.delete("/", () => {
      callStack.push(1);
    });
    router.get("/", () => {
      callStack.push(2);
    });
    router.head("/", () => {
      callStack.push(3);
    });
    router.options("/", () => {
      callStack.push(4);
    });
    router.patch("/", () => {
      callStack.push(5);
    });
    router.post("/", () => {
      callStack.push(6);
    });
    router.put("/", () => {
      callStack.push(7);
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
    router.get("/action1", () => {
      callStack.push(0);
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
    router.get("/route", () => {
      callStack.push(0);
    });
    router.get("/route/", () => {
      callStack.push(1);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0]);
  },
});

test({
  name: "router match encoded path",
  async fn() {
    const { context, next } = setup("/user%2f1", "GET");
    const callStack: number[] = [];
    const router = new Router();
    router.get("/user/:id", () => {
      callStack.push(0);
    });
    router.get("/:path", () => {
      callStack.push(1);
    });
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [1]);
  },
});

test({
  name: "router as iterator",
  fn() {
    const router = new Router();
    router.all("/route", () => {});
    router.delete("/route/:id", () => {});
    router.patch("/route/:id", () => {});
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
    router.all("/", (ctx) => {
      ctx.throw(404);
    });
    const mw = router.routes();
    await assertRejects(async () => {
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
    router.all("/", () => {
      called++;
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
  name: "router redirect, arbitrary URL",
  async fn() {
    const { context, next } = setup("/foo");
    const router = new Router();
    router.redirect("/foo", "https://example.com/", Status.MovedPermanently);
    const mw = router.routes();
    await mw(context, next);
    assertEquals(context.response.status, Status.MovedPermanently);
    assertEquals(
      context.response.headers.get("Location"),
      "https://example.com/",
    );
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
    await assertRejects(async () => {
      await mw(context, next);
    }, errors.NotImplemented);
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
    await assertRejects(async () => {
      await mw(context, next);
    }, errors.MethodNotAllowed);
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
        (ctx) => {
          ctx.params.id;
          ctx.state.session;
        },
      ).get("/:id/names", (ctx) => {
        ctx.params.id;
        ctx.state.session;
      }).put("/:page", (ctx) => {
        ctx.params.page;
      }).put("/value", (ctx) => {
        ctx.params.id;
        ctx.params.page;
        ctx.state.session;
      }).post<{ id: string }>("/:id\\:archive", (ctx) => {
        ctx.params.id;
        // @ts-expect-error
        ctx.params["id:archive"];
        // @ts-expect-error
        ctx.params["id\\:archive"];
      }).routes(),
    ).use((ctx) => {
      ctx.state.id;
    });
  },
});

test({
  name: "router state types",
  fn() {
    const router = new Router<{ foo: string }>();
    router.patch<{ id: string }>(
      "/:id\\:archive",
      (ctx) => {
        ctx.params.id;
        ctx.state.foo;
      },
      (ctx) => {
        ctx.params.id;
        ctx.state.foo;
      },
    );
  },
});

test({
  name: "middleware returned from router.routes() passes next",
  async fn() {
    const { context } = setup("/foo", "GET");

    const callStack: number[] = [];

    async function next() {
      callStack.push(4);
    }

    const router = new Router();
    router.get("/", (_context) => {
      callStack.push(1);
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(2);
      await next();
    });
    router.get("/foo", async (_context, next) => {
      callStack.push(3);
      await next();
    });

    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [2, 3, 4]);
  },
});

test({
  name: "router routes decode pathname before matching",
  async fn() {
    const path = encodeURIComponent("chêne");
    const { context } = setup(`/${path}`, "GET");

    const callStack: number[] = [];

    async function next() {
      callStack.push(3);
    }

    const router = new Router();
    router.get("/chêne", () => {
      callStack.push(2);
    });

    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [2]);
  },
});

test({
  name: "router handling of bad request urls",
  async fn() {
    const headers = new Headers();
    const app = createMockApp<{ id: string }>();
    let context = ({
      app,
      request: {
        headers: new Headers(),
        method: "GET",
        get url() {
          throw new TypeError("bad url");
        },
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
    } as unknown) as Context<{ id: string }>;

    const callStack: number[] = [];
    async function next() {
      callStack.push(1);
    }

    const router = new Router();
    router.get("/a", () => {
      callStack.push(2);
    });

    const mw = router.routes();
    assertRejects(
      async () => await mw(context, next),
      TypeError,
      "bad url",
    );
  },
});

test({
  name: "sub router get single match",
  async fn() {
    const { app, context, next } = setup("/foo/bar", "GET");

    const callStack: number[] = [];
    const router = new Router();
    const subRouter = new Router();
    const subSubRouter = new Router();
    subSubRouter.get("/", (context) => {
      assertStrictEquals(context.router, router);
      assertStrictEquals(context.app, app);
      callStack.push(1);
    });
    subRouter.use("/bar", subSubRouter.routes());
    router.use("/foo", subRouter.routes());
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [1]);
    assertStrictEquals((context as RouterContext<"/foo/bar">).router, router);
  },
});

test({
  name: "sub router match with next",
  async fn() {
    const { context, next } = setup("/foo/bar/baz", "GET");

    const callStack: number[] = [];
    const router = new Router();
    const subRouter = new Router();
    const subSubRouter = new Router();
    subSubRouter.get("/", () => {
      callStack.push(3);
    });
    subSubRouter.get("/baz", async (ctx, next) => {
      callStack.push(4);
      await next();
    });
    subSubRouter.get("/baz", () => {
      callStack.push(5);
    });
    subSubRouter.get("/baz", () => {
      callStack.push(6);
    });
    subRouter.get("/bar/(.*)", async (ctx, next) => {
      callStack.push(2);
      await next();
    });
    subRouter.use("/bar", subSubRouter.routes());
    router.get("/foo/(.*)", async (ctx, next) => {
      callStack.push(1);
      await next();
    });
    router.use("/foo", subRouter.routes());
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [1, 2, 4, 5]);
  },
});

test({
  name: "sub router match single param",
  async fn() {
    const { context, next } = setup("/foo/bar/baz/beep", "GET");

    const callStack: number[] = [];
    const router = new Router();
    const subRouter = new Router();
    const subSubRouter = new Router();
    subSubRouter.get("/", (context) => {
      assertEquals(context.params.id, "bar");
      assertEquals(context.params.name, "beep");
      callStack.push(1);
    });
    subRouter.get("/baz", () => {
      callStack.push(2);
    });
    subRouter.use("/baz/:name", subSubRouter.routes());
    router.get("/foo", () => {
      callStack.push(3);
    });
    router.use("/foo/:id", subRouter.routes());
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [1]);
    assertStrictEquals((context as RouterContext<string>).router, router);
  },
});

test({
  name: "sub router patch prefix with param",
  async fn() {
    const { context, next } = setup("/foo/bar/baz", "GET");
    const callStack: number[] = [];
    const router = new Router();
    const subRouter = new Router({ prefix: "/:bar" });
    subRouter.get("/baz", (ctx) => {
      assertEquals(ctx.params.bar, "bar");
      callStack.push(0);
    });
    router.use("/foo", subRouter.routes());
    const mw = router.routes();
    await mw(context, next);
    assertEquals(callStack, [0]);
  },
});

test({
  name: "sub router match layer prefix",
  async fn() {
    let callStack: number[] = [];
    let matches: string[] = [];
    const router = new Router();
    const subRouter = new Router();
    const subSubRouter = new Router();

    subSubRouter.get("/bar", async (ctx, next) => {
      callStack.push(1);
      matches.push(...(ctx.matched?.map((layer) => layer.path) ?? []));
      await next();
    });
    subRouter.use(subSubRouter.routes());
    subRouter.use("(.*)", subSubRouter.routes());
    router.use("/foo", subRouter.routes());
    const mw = router.routes();

    const { context, next } = setup("/foo/bar", "GET");
    await mw(context, next);
    assertEquals(callStack, [1, 1]);
    assertEquals(matches, [
      "/foo/bar",
      "/foo(.*)/bar",
      "/foo/bar",
      "/foo(.*)/bar",
    ]);
    assertStrictEquals((context as RouterContext<string>).router, router);

    callStack = [];
    matches = [];

    const { context: context2, next: next2 } = setup("/foo/123/bar", "GET");
    await mw(context2, next2);
    assertEquals(callStack, [1]);
    assertEquals(matches, [
      "/foo(.*)/bar",
    ]);
    assertStrictEquals((context2 as RouterContext<string>).router, router);
  },
});

test({
  name: "router - type checking - ensure at least one middleware is passed",
  fn() {
    const router = new Router();

    try {
      // @ts-expect-error
      router.all("/");
      // @ts-expect-error
      router.delete("/");
      // @ts-expect-error
      router.get("/");
      // @ts-expect-error
      router.head("/");
      // @ts-expect-error
      router.options("/");
      // @ts-expect-error
      router.patch("/");
      // @ts-expect-error
      router.post("/");
      // @ts-expect-error
      router.put("/");
      // @ts-expect-error
      router.use();
    } catch {
      //
    }
  },
});
