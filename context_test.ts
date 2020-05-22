// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import {
  test,
  assert,
  assertEquals,
  assertStrictEq,
  assertThrows,
} from "./test_deps.ts";
import { Application, State } from "./application.ts";
import { Context } from "./context.ts";
import { Cookies } from "./cookies.ts";
import { ServerRequest } from "./deps.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { httpErrors } from "./httpError.ts";

function createMockApp<S extends State = Record<string, any>>(
  state = {} as S,
): Application<S> {
  return {
    state,
  } as any;
}

function createMockServerRequest(url = "/", proto = "HTTP/1.1"): ServerRequest {
  const headers = new Headers();
  return {
    headers,
    method: "GET",
    proto,
    url,
    async respond() {},
  } as any;
}

test({
  name: "context",
  fn() {
    const app = createMockApp();
    const serverRequest = createMockServerRequest();
    const context = new Context(app, serverRequest);
    assert(context instanceof Context);
    assertStrictEq(context.state, app.state);
    assertStrictEq(context.app, app);
    assert(context.cookies instanceof Cookies);
    assert(context.request instanceof Request);
    assert(context.response instanceof Response);
  },
});

test({
  name: "context.assert()",
  fn() {
    const context: Context = new Context(
      createMockApp(),
      createMockServerRequest(),
    );
    assertThrows(
      () => {
        let loggedIn: string | undefined;
        context.assert(loggedIn, 401, "Unauthorized");
      },
      httpErrors.Unauthorized,
      "Unauthorized",
    );
  },
});

test({
  name: "context.throw()",
  fn() {
    const context = new Context(createMockApp(), createMockServerRequest());
    assertThrows(
      () => {
        context.throw(404, "foobar");
      },
      httpErrors.NotFound,
      "foobar",
    );
  },
});

test({
  name: "context.send() default path",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest("/test.html"),
    );
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({ root: "./fixtures" });
    assertEquals(context.response.body, fixture);
    assertEquals(context.response.type, ".html");
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
  },
});

test({
  name: "context.send() default path",
  async fn() {
    const context = new Context(
      createMockApp(),
      createMockServerRequest(),
    );
    const fixture = await Deno.readFile("./fixtures/test.html");
    await context.send({ path: "/test.html", root: "./fixtures" });
    assertEquals(context.response.body, fixture);
    assertEquals(context.response.type, ".html");
    assertEquals(
      context.response.headers.get("content-length"),
      String(fixture.length),
    );
    assert(context.response.headers.get("last-modified") != null);
    assertEquals(context.response.headers.get("cache-control"), "max-age=0");
  },
});
