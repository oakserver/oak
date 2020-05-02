// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assertEquals } from "./test_deps.ts";
import { Response } from "./response.ts";

const decoder = new TextDecoder();

test({
  name: "response empty",
  fn() {
    const response = new Response();
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.body, undefined);
    assertEquals(serverResponse.status, 404);
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
    assertEquals(serverResponse.headers!.get("Content-Length"), "0");
  },
});

test({
  name: "response.status set",
  fn() {
    const response = new Response();
    response.status = 302;
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.body, undefined);
    assertEquals(serverResponse.status, 302);
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
    assertEquals(serverResponse.headers!.get("Content-Length"), "0");
  },
});

test({
  name: "response.body as text",
  fn() {
    const response = new Response();
    response.body = "Hello world!";
    const serverResponse = response.toServerResponse();
    assertEquals(decoder.decode(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as HTML",
  fn() {
    const response = new Response();
    response.body = "<!DOCTYPE html><html><body>Hello world!</body></html>";
    const serverResponse = response.toServerResponse();
    assertEquals(
      decoder.decode(serverResponse.body),
      "<!DOCTYPE html><html><body>Hello world!</body></html>",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "text/html; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as JSON",
  fn() {
    const response = new Response();
    response.body = { foo: "bar" };
    const serverResponse = response.toServerResponse();
    assertEquals(decoder.decode(serverResponse.body), `{"foo":"bar"}`);
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "application/json; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as symbol",
  fn() {
    const response = new Response();
    response.body = Symbol("foo");
    const serverResponse = response.toServerResponse();
    assertEquals(decoder.decode(serverResponse.body), "Symbol(foo)");
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.body as Uint8Array",
  fn() {
    const response = new Response();
    response.body = new TextEncoder().encode("Hello world!");
    const serverResponse = response.toServerResponse();
    assertEquals(decoder.decode(serverResponse.body), "Hello world!");
    assertEquals(serverResponse.status, 200);
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 0);
  },
});

test({
  name: "response.type",
  fn() {
    const response = new Response();
    response.type = "js";
    response.body = "console.log('hello world');";
    const serverResponse = response.toServerResponse();
    assertEquals(
      decoder.decode(serverResponse.body),
      "console.log('hello world');",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(
      serverResponse.headers!.get("content-type"),
      "application/javascript; charset=utf-8",
    );
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "response.type does not overwrite",
  fn() {
    const response = new Response();
    response.type = "js";
    response.body = "console.log('hello world');";
    response.headers.set("content-type", "text/plain");
    const serverResponse = response.toServerResponse();
    assertEquals(
      decoder.decode(serverResponse.body),
      "console.log('hello world');",
    );
    assertEquals(serverResponse.status, 200);
    assertEquals(serverResponse.headers!.get("Content-Type"), "text/plain");
    assertEquals(Array.from(serverResponse.headers!.entries()).length, 1);
  },
});

test({
  name: "empty response sets contentLength to 0",
  fn() {
    const response = new Response();
    const serverResponse = response.toServerResponse();
    assertEquals(serverResponse.headers!.get("Content-Length"), "0");
  },
});
