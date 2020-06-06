// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { assert, assertEquals, assertThrowsAsync, test } from "./test_deps.ts";

import { httpErrors } from "./httpError.ts";
import { FormDataFile, FormDataReader } from "./multipart.ts";
import { equal, lookup, parse } from "./deps.ts";
import { stripEol } from "./util.ts";

// const decoder = new TextDecoder();
const encoder = new TextEncoder();

const fixtureContentType = `multipart/form-data; boundary=OAK-SERVER-BOUNDARY`;

const fixture = `leading to be ignored

--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="id"

555
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="title"

Hello World
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="author"

world, hello
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="fileb"; filename="mod2.ts"
Content-Type: video/mp2t

export { printHello } from "./print_hello.ts";
--OAK-SERVER-BOUNDARY--

trailing to be ignored
`;

function createBody(value: string): Deno.Buffer {
  return new Deno.Buffer(encoder.encode(value));
}

function createBodyFile(
  name: string,
  filename: string,
): [Uint8Array, Deno.Buffer] {
  const fileData = Deno.readFileSync(filename);
  const mediaType = lookup(filename);
  const basename = parse(filename).base;
  const pre = `
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="${name}"; filename="${basename}"
Content-Type: ${mediaType}

`;
  const post = `\r\n--OAK-SERVER-BOUNDARY--\r\n`;
  const buffer = new Deno.Buffer();
  Deno.writeAllSync(buffer, encoder.encode(pre));
  Deno.writeAllSync(buffer, fileData);
  Deno.writeAllSync(buffer, encoder.encode(post));
  return [fileData, buffer];
}

test({
  name: "multipart - FormDataReader - .read() basic",
  async fn() {
    const body = createBody(fixture);
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual = await fdr.read();
    assertEquals(
      actual.fields,
      { id: "555", title: "Hello World", author: "world, hello" },
    );
    assert(actual.files);
    assertEquals(actual.files.length, 1);
    assertEquals(actual.files[0].contentType, "video/mp2t");
    assertEquals(actual.files[0].name, "fileb");
    assertEquals(actual.files[0].originalName, "mod2.ts");
    assert(actual.files[0].filename);
  },
});

test({
  name: "multipart - FormDataReader - .stream() basic",
  async fn() {
    const body = createBody(fixture);
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual: [string, string | FormDataFile][] = [];
    for await (const result of fdr.stream()) {
      actual.push(result);
    }
    assertEquals(actual.length, 4);
    assertEquals(
      actual.map(([key]) => key),
      ["id", "title", "author", "fileb"],
    );
    assertEquals(
      actual.map(([, value]) => typeof value),
      ["string", "string", "string", "object"],
    );
  },
});

test({
  name: "multipart - FormDataReader - .stream() file default",
  async fn() {
    const [expected, body] = createBodyFile("fileA", "./fixtures/test.jpg");
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual: [string, string | FormDataFile][] = [];
    for await (const result of fdr.stream()) {
      actual.push(result);
    }
    assertEquals(actual.length, 1);
    assertEquals(actual[0][0], "fileA");
    const [, actualItem] = actual[0];
    assert(typeof actualItem === "object");
    assertEquals(actualItem.content, undefined);
    assertEquals(actualItem.contentType, "image/jpeg");
    assertEquals(actualItem.name, "fileA");
    assertEquals(actualItem.originalName, "test.jpg");
    assert(actualItem.filename);
    assert(actualItem.filename.endsWith(".jpeg"));
    const actualFileData = await Deno.readFile(actualItem.filename);
    assert(equal(stripEol(actualFileData), expected));
  },
});

test({
  name: "multipart - FormDataReader - .stream() file memory",
  async fn() {
    const [expected, body] = createBodyFile("fileA", "./fixtures/test.jpg");
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual: [string, string | FormDataFile][] = [];
    for await (const result of fdr.stream({ maxSize: 400000 })) {
      actual.push(result);
    }
    assertEquals(actual.length, 1);
    assertEquals(actual[0][0], "fileA");
    const [, actualItem] = actual[0];
    assert(typeof actualItem === "object");
    assertEquals(actualItem.contentType, "image/jpeg");
    assertEquals(actualItem.name, "fileA");
    assertEquals(actualItem.originalName, "test.jpg");
    assert(actualItem.content);
    assert(equal(stripEol(actualItem.content), expected));
  },
});

test({
  name: "multipart - FormDataReader - .stream() file maxSize overflow",
  async fn() {
    const [expected, body] = createBodyFile("fileA", "./fixtures/test.jpg");
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual: [string, string | FormDataFile][] = [];
    for await (const result of fdr.stream({ maxSize: 100000 })) {
      actual.push(result);
    }
    assertEquals(actual.length, 1);
    assertEquals(actual[0][0], "fileA");
    const [, actualItem] = actual[0];
    assert(typeof actualItem === "object");
    assertEquals(actualItem.content, undefined);
    assertEquals(actualItem.contentType, "image/jpeg");
    assertEquals(actualItem.name, "fileA");
    assertEquals(actualItem.originalName, "test.jpg");
    assert(actualItem.filename);
    assert(actualItem.filename.endsWith(".jpeg"));
    const actualFileData = await Deno.readFile(actualItem.filename);
    assert(equal(stripEol(actualFileData), expected));
  },
});

test({
  name: "multipart - FormDataReader - .read() maxFileSize exceeded",
  async fn() {
    const [, body] = createBodyFile("fileA", "./fixtures/test.jpg");
    const fdr = new FormDataReader(fixtureContentType, body);
    await assertThrowsAsync(async () => {
      await fdr.read({ maxFileSize: 100000 });
    }, httpErrors.RequestEntityTooLarge);
  },
});
