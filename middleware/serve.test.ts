import type { State } from "../application.ts";
import { Context } from "../context.ts";
import { assert } from "../deps.ts";
import { NativeRequest } from "../http_server_native_request.ts";
import type { Next } from "../middleware.ts";
import { type RouteParams, Router, type RouterContext } from "../router.ts";
import { assertEquals, assertStrictEquals } from "../deps_test.ts";
import { createMockApp, createMockNext } from "../testing.ts";
import { isNode } from "../utils/type_guards.ts";

import { route, serve } from "./serve.ts";

function setup<R extends string = "/", S extends State = State>(
  request: Request,
  remoteAddr: Deno.NetAddr = {
    transport: "tcp",
    hostname: "localhost",
    port: 8080,
  },
): [Context<S>, RouterContext<R, RouteParams<R>, S>, Next] {
  const app = createMockApp();
  const serverRequest = new NativeRequest(request, { remoteAddr });
  const context = new Context<S>(app, serverRequest, app.state as S);
  const routerContext = new Context(
    app,
    serverRequest,
    app.state,
  ) as RouterContext<R, RouteParams<R>, S>;
  Object.assign(routerContext, {
    captures: [],
    params: { "a": "b" },
    router: {} as Router,
    routeName: "c",
    routePath: "d",
  });
  return [context, routerContext, createMockNext()];
}

Deno.test({
  name: "serve - source request and response are strictly equal",
  async fn() {
    const request = new Request("http://localhost:8888/index.html");
    const [context, , next] = setup(request);
    let response: Response;
    const mw = serve((req) => {
      assertStrictEquals(req, request);
      return response = new Response();
    });
    await mw(context, next);
    assertStrictEquals(await context.response.toDomResponse(), response!);
  },
});

Deno.test({
  name: "serve - context is valid",
  async fn() {
    const request = new Request("http://localhost:8888/index.html");
    const [context, , next] = setup(request);
    const mw = serve((_req, ctx) => {
      assert(ctx.app);
      assert(ctx.state);
      assertEquals(typeof ctx.assert, "function");
      assertEquals(typeof ctx.throw, "function");
      return new Response();
    });
    await mw(context, next);
  },
});

Deno.test({
  name: "serve - inspection is expected",
  async fn() {
    const request = new Request("http://localhost:8888/index.html");
    const [context, , next] = setup(request);
    const mw = serve((_req, ctx) => {
      assertEquals(
        Deno.inspect(ctx),
        isNode()
          ? `ServeContext { app: MockApplication {}, ip: 'localhost', ips: [], state: {} }`
          : `ServeContext { app: MockApplication {}, ip: "localhost", ips: [], state: {} }`,
      );
      return new Response();
    });
    await mw(context, next);
  },
});

Deno.test({
  name: "route - source request and response are strictly equal",
  async fn() {
    const request = new Request("http://localhost:8888/index.html");
    const [, context, next] = setup(request);
    let response: Response;
    const mw = route<"/", RouteParams<"/">, State>((req) => {
      assertStrictEquals(req, request);
      return response = new Response();
    });
    await mw(context, next);
    assertStrictEquals(await context.response.toDomResponse(), response!);
  },
});

Deno.test({
  name: "route - context is valid",
  async fn() {
    const request = new Request("http://localhost:8888/book/1234");
    const [context, , next] = setup(request);
    const router = new Router();
    router.get(
      "/book/:id",
      route((_req, ctx) => {
        assertEquals(ctx.captures, ["1234"]);
        assertEquals(ctx.params, { id: "1234" });
        assertEquals(ctx.routeName, undefined);
        assertStrictEquals(ctx.router, router);
        assertEquals(ctx.routerPath, undefined);
        return new Response();
      }),
    );
    const mw = router.routes();
    await mw(context, next);
  },
});

Deno.test({
  name: "route - inspection is expected",
  async fn() {
    const request = new Request("http://localhost:8888/book/1234");
    const [context, , next] = setup(request);
    const router = new Router();
    router.get(
      "/book/:id",
      route((_req, ctx) => {
        assertEquals(
          Deno.inspect(ctx),
          isNode()
            ? `RouteContext {\n  app: MockApplication {},\n  captures: [ '1234' ],\n  matched: [ [Layer] ],\n  ip: 'localhost',\n  ips: [],\n  params: { id: '1234' },\n  router: Router { '#params': {}, '#stack': [Array] },\n  routeName: undefined,\n  routerPath: undefined,\n  state: {}\n}`
            : `RouteContext {\n  app: MockApplication {},\n  captures: [ "1234" ],\n  matched: [\n    Layer {\n  methods: [ "HEAD", "GET" ],\n  middleware: [ [AsyncFunction (anonymous)] ],\n  options: {\n    end: undefined,\n    sensitive: undefined,\n    strict: undefined,\n    ignoreCaptures: undefined\n  },\n  paramNames: [ "id" ],\n  path: "/book/:id",\n  regexp: /^\\/book(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$/i\n}\n  ],\n  ip: "localhost",\n  ips: [],\n  params: { id: "1234" },\n  router: Router {\n  "#params": {},\n  "#stack": [\n    Layer {\n  methods: [ "HEAD", "GET" ],\n  middleware: [ [AsyncFunction (anonymous)] ],\n  options: {\n    end: undefined,\n    sensitive: undefined,\n    strict: undefined,\n    ignoreCaptures: undefined\n  },\n  paramNames: [ "id" ],\n  path: "/book/:id",\n  regexp: /^\\/book(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$/i\n}\n  ]\n},\n  routeName: undefined,\n  routerPath: undefined,\n  state: {}\n}`,
        );
        return new Response();
      }),
    );
    const mw = router.routes();
    await mw(context, next);
  },
});
