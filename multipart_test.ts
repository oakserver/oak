// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import {
  assert,
  assertEquals,
  assertRejects,
  Buffer,
  writeAllSync,
} from "./test_deps.ts";

import { FormDataFile, FormDataReader } from "./multipart.ts";
import { equals, errors, extname, parse, typeByExtension } from "./deps.ts";
import { isNode, stripEol } from "./util.ts";

const { test } = Deno;

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

const fixtureNoFields = `
--OAK-SERVER-BOUNDARY--
`;

const fixtureUtf8Filename = `
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="id"

555
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="filea"; filename="编写软件很难.ts"
Content-Type: video/mp2t

export { printHello } from "./print_hello.ts";
--OAK-SERVER-BOUNDARY--
`;

const fixtureNoNewline = `
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="noNewline"; filename="noNewline.txt"
Content-Type: text/plain

555
--OAK-SERVER-BOUNDARY--
`;

function createBody(value: string): Buffer {
  return new Buffer(encoder.encode(value));
}

function createBodyFile(
  name: string,
  filename: string,
  contentType?: string,
): [Uint8Array, Buffer] {
  const fileData = Deno.readFileSync(filename);
  const mediaType = contentType ?? typeByExtension(extname(filename));
  const basename = parse(filename).base;
  const pre = `
--OAK-SERVER-BOUNDARY
Content-Disposition: form-data; name="${name}"; filename="${basename}"
Content-Type: ${mediaType}

`;
  const post = `\r\n--OAK-SERVER-BOUNDARY--\r\n`;
  const buffer = new Buffer();
  writeAllSync(buffer, encoder.encode(pre));
  writeAllSync(buffer, fileData);
  writeAllSync(buffer, encoder.encode(post));
  return [fileData, buffer];
}

test({
  name: "multipart - FormDataReader - .read() basic",
  ignore: isNode(),
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
  ignore: isNode(),
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
  ignore: isNode(),
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
    assert(equals(stripEol(actualFileData), expected));
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
    assert(equals(stripEol(actualItem.content), expected));
  },
});

test({
  name: "multipart - FormDataReader - .stream() file maxSize overflow",
  ignore: isNode(),
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
    assert(equals(stripEol(actualFileData), expected));
  },
});

test({
  name: "multipart - FormDataReader - .read() maxFileSize exceeded",
  async fn() {
    const [, body] = createBodyFile("fileA", "./fixtures/test.jpg");
    const fdr = new FormDataReader(fixtureContentType, body);
    await assertRejects(async () => {
      await fdr.read({ maxFileSize: 100000 });
    }, errors.RequestEntityTooLarge);
  },
});

test({
  name: "multipart - FormDataReader - .read() custom content type",
  ignore: isNode(),
  async fn() {
    const [, body] = createBodyFile(
      "fileA",
      "./fixtures/test.txt",
      "text/vnd.custom",
    );
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual = await fdr.read({
      customContentTypes: { "text/vnd.custom": "txt" },
    });
    assertEquals(actual.files?.length, 1);
    assertEquals(actual.files?.[0].contentType, "text/vnd.custom");
    assert(actual.files?.[0].filename?.endsWith(".txt"));
  },
});

test({
  name: "multipart - FormDataReader - body with no fields",
  async fn() {
    const body = createBody(fixtureNoFields);
    const fdr = new FormDataReader(fixtureContentType, body);
    const value = await fdr.read();
    assertEquals(Object.keys(value.fields).length, 0);
    assertEquals(value.files, undefined);
  },
});

test({
  name: "multipart - FormDataReader - body with mbc filename part",
  ignore: isNode(),
  async fn() {
    const body = createBody(fixtureUtf8Filename);
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual = await fdr.read();
    assertEquals(actual.fields, { id: "555" });
    assert(actual.files);
    assertEquals(actual.files.length, 1);
    assertEquals(actual.files[0].contentType, "video/mp2t");
    assertEquals(actual.files[0].name, "filea");
    assertEquals(actual.files[0].originalName, "编写软件很难.ts");
  },
});

test({
  name:
    "multipart - FormDataReader - .read() no extra CRLF at the end of result file if origin file doesn't end with newline",
  ignore: isNode(),
  async fn() {
    const body = createBody(fixtureNoNewline);
    const fdr = new FormDataReader(fixtureContentType, body);
    const actual = await fdr.read();

    assert(actual.files);
    assertEquals(actual.files.length, 1);
    assertEquals(actual.files[0].contentType, "text/plain");
    assertEquals(actual.files[0].name, "noNewline");
    assertEquals(actual.files[0].originalName, "noNewline.txt");
    assert(actual.files[0].filename);

    const file = await Deno.stat(actual.files[0].filename);
    assertEquals(file.size, 3);
  },
});

test({
  name: "FormDataReader - inspecting",
  fn() {
    const body = createBody(fixture);
    assertEquals(
      Deno.inspect(new FormDataReader(fixtureContentType, body)),
      `FormDataReader {}`,
    );
  },
});
