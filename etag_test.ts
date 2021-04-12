// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, test } from "./test_deps.ts";

import type { Application } from "./application.ts";
import type { Context } from "./context.ts";
import { Status } from "./deps.ts";

import { calculate, factory, ifMatch, ifNoneMatch } from "./etag.ts";

let encodingsAccepted = "identity";

function createMockApp<
  // deno-lint-ignore no-explicit-any
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  state = {} as S,
): Application<S> {
  return {
    state,
    // deno-lint-ignore no-explicit-any
  } as any;
}

function createMockContext<
  // deno-lint-ignore no-explicit-any
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  app: Application<S>,
  path = "/",
  method = "GET",
) {
  // deno-lint-ignore no-explicit-any
  let body: any;
  let status = Status.OK;
  const headers = new Headers();
  const resources: number[] = [];
  return ({
    app,
    request: {
      acceptsEncodings() {
        return encodingsAccepted;
      },
      headers: new Headers(),
      method,
      path,
      search: undefined,
      searchParams: new URLSearchParams(),
      url: new URL(`http://localhost${path}`),
    },
    response: {
      get status(): Status {
        return status;
      },
      set status(value: Status) {
        status = value;
      },
      // deno-lint-ignore no-explicit-any
      get body(): any {
        return body;
      },
      // deno-lint-ignore no-explicit-any
      set body(value: any) {
        body = value;
      },
      addResource(rid: number) {
        resources.push(rid);
      },
      destroy() {
        body = undefined;
        for (const rid of resources) {
          Deno.close(rid);
        }
      },
      headers,
      toServerResponse() {
        return Promise.resolve({
          status,
          body,
          headers,
        });
      },
    },
    state: app.state,
  } as unknown) as Context<S>;
}

function setup<
  // deno-lint-ignore no-explicit-any
  S extends Record<string | number | symbol, any> = Record<string, any>,
>(
  path = "/",
  method = "GET",
): {
  app: Application<S>;
  context: Context<S>;
} {
  encodingsAccepted = "identity";
  const app = createMockApp<S>();
  const context = createMockContext<S>(app, path, method);
  return { app, context };
}

const encoder = new TextEncoder();

test({
  name: "etag - calculate - string - empty",
  fn() {
    const actual = calculate("");
    assertEquals(actual, `"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk="`);
  },
});

test({
  name: "etag - calculate - string",
  fn() {
    const actual = calculate("hello deno");
    assertEquals(actual, `"a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`);
  },
});

test({
  name: "etag - calculate - Uint8Array - empty",
  fn() {
    const actual = calculate(new Uint8Array());
    assertEquals(actual, `"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk="`);
  },
});

test({
  name: "etag - calculate - Uint8Array - empty",
  fn() {
    const actual = calculate(encoder.encode("hello deno"));
    assertEquals(actual, `"a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`);
  },
});

test({
  name: "etag - calculate - Deno.FileInfo",
  fn() {
    const fixture: Deno.FileInfo = {
      isFile: true,
      isDirectory: false,
      isSymlink: false,
      size: 1024,
      mtime: new Date(Date.UTC(96, 1, 2, 3, 4, 5, 6)),
      atime: null,
      birthtime: null,
      dev: null,
      ino: null,
      mode: null,
      nlink: null,
      uid: null,
      gid: null,
      rdev: null,
      blksize: null,
      blocks: null,
    };
    const actual = calculate(fixture);
    assertEquals(actual, `W/"400-bfac58a88e"`);
  },
});

test({
  name: "etag - middleware - body string",
  async fn() {
    const { context } = setup();
    function next() {
      context.response.body = "hello deno";
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      `"a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`,
    );
  },
});

test({
  name: "etag - middleware - body Uint8Array",
  async fn() {
    const { context } = setup();
    function next() {
      context.response.body = encoder.encode("hello deno");
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      `"a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`,
    );
  },
});

test({
  name: "etag - middleware - body File",
  async fn() {
    const { context } = setup();
    let file: Deno.File;
    async function next() {
      file = await Deno.open("./fixtures/test.jpg", {
        read: true,
      });
      context.response.body = file;
    }

    const mw = factory();
    await mw(context, next);
    // Deno.fstat is currently an unstable API in Deno, but the code is written
    // to fail gracefully, so we sniff if the API is unavailable and change
    // the assertions accordingly.
    if ("fstat" in Deno) {
      const actual = context.response.headers.get("etag");
      // mtime will vary from system to system which makes up part of the hash
      // we we only look at the part that is consistent.
      assert(actual && actual.startsWith(`W/"4a3b7-`));
    } else {
      assertEquals(
        context.response.headers.get("etag"),
        null,
      );
    }

    file!.close();
  },
});

test({
  name: "etag - middleware - body JSON-like",
  async fn() {
    const { context } = setup();
    function next() {
      context.response.body = { msg: "hello deno" };
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      `"14-KZ23xGibHn2QLCgZY4YQIjYHYhI"`,
    );
  },
});

test({
  name: "etag - middleware - body function",
  async fn() {
    // if we call the body function in the middleware, we cause problems with
    // the response, so we just have to ignore body functions
    const { context } = setup();
    function next() {
      context.response.body = () => Promise.resolve("hello deno");
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      null,
    );
  },
});

test({
  name: "etag - middleware - body async iterator",
  async fn() {
    // The only async readable we can really support is Deno.File, because we
    // know how to get the meta data in order to build a weak tag.  Other async
    // iterables should be ignored and not serialized as JSON.
    const { context } = setup();
    function next() {
      context.response.body = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("hello deno");
          controller.close();
        },
      });
      return Promise.resolve();
    }

    const mw = factory();
    await mw(context, next);
    assertEquals(
      context.response.headers.get("etag"),
      null,
    );
  },
});

test({
  name: "etag - ifMatch",
  fn() {
    assert(!ifMatch(`"abcdefg"`, "hello deno"));
    assert(ifMatch(`"a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`, "hello deno"));
    assert(ifMatch(`"abcdefg", "a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`, "hello deno"));
    assert(ifMatch("*", "hello deno"));
    assert(
      !ifMatch("*", {
        size: 1024,
        mtime: new Date(Date.UTC(96, 1, 2, 3, 4, 5, 6)),
      }),
    );
  },
});

test({
  name: "etag - ifNoneMatch",
  fn() {
    assert(ifNoneMatch(`"abcdefg"`, "hello deno"));
    assert(!ifNoneMatch(`"a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`, "hello deno"));
    assert(
      !ifNoneMatch(`"abcdefg", "a-l+ghcNTLpmZ9DVs/87qbgBvpV0M"`, "hello deno"),
    );
    assert(!ifNoneMatch("*", "hello deno"));
    assert(
      !ifNoneMatch(`W/"400-bfac58a88e"`, {
        size: 1024,
        mtime: new Date(Date.UTC(96, 1, 2, 3, 4, 5, 6)),
      }),
    );
    assert(
      ifNoneMatch(`"400-bfac58a88e"`, {
        size: 1024,
        mtime: new Date(Date.UTC(96, 1, 2, 3, 4, 5, 6)),
      }),
    );
  },
});
