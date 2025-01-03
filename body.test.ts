import { Body } from "./body.ts";
import { assert, concat, isHttpError, Status } from "./deps.ts";
import { assertEquals, assertRejects, timingSafeEqual } from "./deps_test.ts";
import type { ServerRequest } from "./types.ts";

const MULTIPART_BODY_FIXTURE =
  `--OAK-SERVER-BOUNDARY\r\nContent-Disposition: form-data; name="hello"\r\n\r\nworld\r\n--OAK-SERVER-BOUNDARY--\r\n`;

const MULTIPART_CONTENTTYPE_FIXTURE =
  `multipart/form-data; boundary=OAK-SERVER-BOUNDARY`;

const encoder = new TextEncoder();

function nativeToServer(
  request: Request,
): Pick<ServerRequest, "request" | "headers" | "getBody"> {
  return {
    request,
    headers: request.headers,
    getBody() {
      return request.body;
    },
  };
}

function nodeToServer(
  headers: HeadersInit,
  body: BodyInit,
): Pick<ServerRequest, "request" | "headers" | "getBody"> {
  const req = new Request("https://localhost", {
    method: "POST",
    body,
    headers,
  });
  return {
    headers: req.headers,
    getBody() {
      return req.body;
    },
  };
}

Deno.test({
  name: "body - form - native request",
  async fn() {
    const rBody = `foo=bar&bar=1&baz=qux+%2B+quux`;
    const body = new Body(nativeToServer(
      new Request(
        "http://localhost/index.html",
        {
          body: rBody,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": String(rBody.length),
          },
        },
      ),
    ));
    assert(body.has);
    assertEquals(body.type(), "form");
    const actual = await body.form();
    assertEquals(
      Array.from(actual.entries()),
      [["foo", "bar"], ["bar", "1"], ["baz", "qux + quux"]],
    );
  },
});

Deno.test({
  name: "body - form - node request",
  async fn() {
    const rBody = `foo=bar&bar=1&baz=qux+%2B+quux`;
    const body = new Body(nodeToServer(
      {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(rBody.length),
      },
      rBody,
    ));
    assert(body.has);
    assertEquals(body.type(), "form");
    const actual = await body.form();
    assertEquals(
      Array.from(actual.entries()),
      [["foo", "bar"], ["bar", "1"], ["baz", "qux + quux"]],
    );
  },
});

Deno.test({
  name: "body - formData - native request",
  async fn() {
    const body = new Body(nativeToServer(
      new Request(
        "http://localhost/index.html",
        {
          body: MULTIPART_BODY_FIXTURE,
          method: "POST",
          headers: {
            "content-type": MULTIPART_CONTENTTYPE_FIXTURE,
          },
        },
      ),
    ));
    assert(body.has);
    assertEquals(body.type(), "form-data");
    const actual = await body.formData();
    assertEquals([...actual], [
      ["hello", "world"],
    ]);
  },
});

Deno.test({
  name: "body - formData - node request",
  async fn() {
    const body = new Body(
      nodeToServer(
        { "content-type": MULTIPART_CONTENTTYPE_FIXTURE },
        MULTIPART_BODY_FIXTURE,
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "form-data");
    const actual = await body.formData();
    assertEquals([...actual], [
      ["hello", "world"],
    ]);
  },
});

Deno.test({
  name: "body - json - native request",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const body = new Body(
      nativeToServer(
        new Request(
          "http://localhost/index.html",
          {
            body: rBody,
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": String(rBody.length),
            },
          },
        ),
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    assertEquals(await body.json(), { hello: "world" });
  },
});

Deno.test({
  name: "body - json - native request - reread does not throw",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const body = new Body(
      nativeToServer(
        new Request(
          "http://localhost/index.html",
          {
            body: rBody,
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": String(rBody.length),
            },
          },
        ),
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    assertEquals(await body.json(), { hello: "world" });
    assertEquals(body.used, true);
    assertEquals(await body.json(), { hello: "world" });
  },
});

Deno.test({
  name: "body - json - native request - read as text first",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const body = new Body(
      nativeToServer(
        new Request(
          "http://localhost/index.html",
          {
            body: rBody,
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": String(rBody.length),
            },
          },
        ),
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    assertEquals(await body.text(), rBody);
    assertEquals(body.used, true);
    assertEquals(await body.json(), { hello: "world" });
  },
});

Deno.test({
  name: "body - json - node request",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const body = new Body(
      nodeToServer(
        {
          "content-type": "application/json",
          "content-length": String(rBody.length),
        },
        rBody,
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    assertEquals(await body.json(), { hello: "world" });
  },
});

Deno.test({
  name: "body - json - node request - reread body does not throw",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const body = new Body(
      nodeToServer(
        {
          "content-type": "application/json",
          "content-length": String(rBody.length),
        },
        rBody,
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    assertEquals(await body.json(), { hello: "world" });
    assertEquals(body.used, true);
    assertEquals(await body.json(), { hello: "world" });
  },
});

Deno.test({
  name: "body - json - node request - read as text first then json",
  async fn() {
    const rBody = JSON.stringify({ hello: "world" });
    const body = new Body(
      nodeToServer(
        {
          "content-type": "application/json",
          "content-length": String(rBody.length),
        },
        rBody,
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    assertEquals(await body.text(), rBody);
    assertEquals(body.used, true);
    assertEquals(await body.json(), { hello: "world" });
  },
});

Deno.test({
  name: "body - json does not parse - native request",
  async fn() {
    const rBody = `{ hello: "world" }`;
    const body = new Body(
      nativeToServer(
        new Request(
          "http://localhost/index.html",
          {
            body: rBody,
            method: "POST",
            headers: {
              "content-type": "application/json",
              "content-length": String(rBody.length),
            },
          },
        ),
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    const err = await assertRejects(async () => {
      await body.json();
    }, Error);
    assert(isHttpError(err));
    assertEquals(err.status, Status.BadRequest);
  },
});

Deno.test({
  name: "body - json does not parse - node request",
  async fn() {
    const rBody = `{ hello: "world" }`;
    const body = new Body(
      nodeToServer(
        {
          "content-type": "application/json",
          "content-length": String(rBody.length),
        },
        rBody,
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "json");
    const err = await assertRejects(async () => {
      await body.json();
    }, Error);
    assert(isHttpError(err));
    assertEquals(err.status, Status.BadRequest);
  },
});

Deno.test({
  name: "body - text - native request",
  async fn() {
    const rBody = "hello world";
    const body = new Body(
      nativeToServer(
        new Request("http://localhost:8080", {
          body: rBody,
          method: "POST",
          headers: { "content-type": "text/plain" },
        }),
      ),
    );
    assert(body.has);
    assertEquals(body.type(), "text");
    assertEquals(await body.text(), rBody);
  },
});

Deno.test({
  name: "body - text - node request",
  async fn() {
    const rBody = "hello world";
    const body = new Body(
      nodeToServer({ "content-type": "text/plain" }, rBody),
    );
    assert(body.has);
    assertEquals(body.type(), "text");
    assertEquals(await body.text(), rBody);
  },
});

Deno.test({
  name: "body - arrayBuffer - native request",
  async fn() {
    const rBody = "hello world";
    const expected = encoder.encode(rBody);
    const body = new Body(nativeToServer(
      new Request("http://localhost:8080", {
        body: rBody,
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
      }),
    ));
    assert(body.has);
    assertEquals(body.type(), "binary");
    assert(timingSafeEqual(await body.arrayBuffer(), expected));
  },
});

Deno.test({
  name: "body - arrayBuffer - node request",
  async fn() {
    const rBody = "hello world";
    const expected = encoder.encode(rBody);
    const body = new Body(
      nodeToServer({ "content-type": "application/octet-stream" }, rBody),
    );
    assert(body.has);
    assertEquals(body.type(), "binary");
    assert(timingSafeEqual(await body.arrayBuffer(), expected));
  },
});

Deno.test({
  name: "body - blob - native request",
  async fn() {
    const rBody = "hello world";
    const expected = encoder.encode(rBody);
    const body = new Body(nativeToServer(
      new Request("http://localhost:8080", {
        body: rBody,
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
      }),
    ));
    assert(body.has);
    assertEquals(body.type(), "binary");
    const actual = await body.blob();
    assert(timingSafeEqual(await actual.arrayBuffer(), expected));
  },
});

Deno.test({
  name: "body - blob - node request",
  async fn() {
    const rBody = "hello world";
    const expected = encoder.encode(rBody);
    const body = new Body(
      nodeToServer({ "content-type": "application/octet-stream" }, rBody),
    );
    assert(body.has);
    assertEquals(body.type(), "binary");
    const actual = await body.blob();
    assert(timingSafeEqual(await actual.arrayBuffer(), expected));
  },
});

Deno.test({
  name: "body - stream - native request",
  async fn() {
    const rBody = "hello world";
    const expected = encoder.encode(rBody);
    const body = new Body(nativeToServer(
      new Request("http://localhost:8080", {
        body: rBody,
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
      }),
    ));
    assert(body.has);
    assertEquals(body.type(), "binary");
    assert(body.stream);
    let actual = new Uint8Array();
    for await (const chunk of body.stream) {
      actual = concat([actual, chunk]);
    }
    assert(timingSafeEqual(actual, expected));
  },
});

Deno.test({
  name: "body - stream - node request",
  async fn() {
    const rBody = "hello world";
    const expected = encoder.encode(rBody);
    const body = new Body(
      nodeToServer({ "content-type": "application/octet-stream" }, rBody),
    );
    assert(body.has);
    assertEquals(body.type(), "binary");
    assert(body.stream);
    let actual = new Uint8Array();
    for await (const chunk of body.stream) {
      actual = concat([actual, chunk]);
    }
    assert(timingSafeEqual(actual, expected));
  },
});

Deno.test({
  name: "body - empty",
  async fn() {
    const body = new Body(nativeToServer(
      new Request(
        "http://localhost/index.html",
        {
          method: "GET",
        },
      ),
    ));
    assert(!body.has);
    assertEquals(await body.init(), null);
  },
});
