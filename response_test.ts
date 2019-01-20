// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { test, assert } from "https://deno.land/x/std/testing/mod.ts";
import { Response } from "./response.ts";

const decoder = new TextDecoder();

test(function emptyResponse() {
  const response = new Response();
  const serverResponse = response.toServerResponse();
  assert.equal(serverResponse.body, undefined);
  assert.equal(serverResponse.status, 404);
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 0);
});

test(function statusSet() {
  const response = new Response();
  response.status = 302;
  const serverResponse = response.toServerResponse();
  assert.equal(serverResponse.body, undefined);
  assert.equal(serverResponse.status, 302);
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 0);
});

test(function bodyText() {
  const response = new Response();
  response.body = "Hello world!";
  const serverResponse = response.toServerResponse();
  assert.equal(decoder.decode(serverResponse.body), "Hello world!");
  assert.equal(serverResponse.status, 200);
  assert.equal(
    serverResponse.headers!.get("content-type"),
    "text/plain; charset=utf-8"
  );
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 1);
});

test(function bodyHtml() {
  const response = new Response();
  response.body = "<!DOCTYPE html><html><body>Hello world!</body></html>";
  const serverResponse = response.toServerResponse();
  assert.equal(
    decoder.decode(serverResponse.body),
    "<!DOCTYPE html><html><body>Hello world!</body></html>"
  );
  assert.equal(serverResponse.status, 200);
  assert.equal(
    serverResponse.headers!.get("content-type"),
    "text/html; charset=utf-8"
  );
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 1);
});

test(function bodyJson() {
  const response = new Response();
  response.body = { foo: "bar" };
  const serverResponse = response.toServerResponse();
  assert.equal(decoder.decode(serverResponse.body), `{"foo":"bar"}`);
  assert.equal(serverResponse.status, 200);
  assert.equal(
    serverResponse.headers!.get("content-type"),
    "application/json; charset=utf-8"
  );
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 1);
});

test(function bodySymbol() {
  const response = new Response();
  response.body = Symbol("foo");
  const serverResponse = response.toServerResponse();
  assert.equal(decoder.decode(serverResponse.body), "Symbol(foo)");
  assert.equal(serverResponse.status, 200);
  assert.equal(
    serverResponse.headers!.get("content-type"),
    "text/plain; charset=utf-8"
  );
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 1);
});

test(function bodyUint8Array() {
  const response = new Response();
  response.body = new TextEncoder().encode("Hello world!");
  const serverResponse = response.toServerResponse();
  assert.equal(decoder.decode(serverResponse.body), "Hello world!");
  assert.equal(serverResponse.status, 200);
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 0);
});

test(function typeDoesNotOverwrite() {
  const response = new Response();
  response.type = "js";
  response.body = "console.log('hello world');";
  const serverResponse = response.toServerResponse();
  assert.equal(
    decoder.decode(serverResponse.body),
    "console.log('hello world');"
  );
  assert.equal(serverResponse.status, 200);
  assert.equal(
    serverResponse.headers!.get("content-type"),
    "application/javascript; charset=utf-8"
  );
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 1);
});

test(function contentTypeDoesNotOverwrite() {
  const response = new Response();
  response.type = "js";
  response.body = "console.log('hello world');";
  response.headers.set("content-type", "text/plain");
  const serverResponse = response.toServerResponse();
  assert.equal(
    decoder.decode(serverResponse.body),
    "console.log('hello world');"
  );
  assert.equal(serverResponse.status, 200);
  assert.equal(serverResponse.headers!.get("Content-Type"), "text/plain");
  assert.equal(Array.from(serverResponse.headers!.entries()).length, 1);
});
