import { parse } from "./form_data.ts";
import { assertEquals } from "./test_deps.ts";

const FIXTURE_CONTENT_TYPE =
  `multipart/form-data; boundary=OAK-SERVER-BOUNDARY`;
const FIXTURE_BODY =
  '--OAK-SERVER-BOUNDARY\r\nContent-Disposition: form-data; name="id"\r\n\r\n555\r\n--OAK-SERVER-BOUNDARY\r\nContent-Disposition: form-data; name="title"\r\n\r\nHello\nWorld\n\r\n--OAK-SERVER-BOUNDARY\r\nContent-Disposition: form-data; name="fileb"; filename="mod2.ts"\r\nContent-Type: video/mp2t\r\n\r\nconsole.log("Hello world");\n\r\n--OAK-SERVER-BOUNDARY--\r\n';

const FIXTURE_BODY_NO_FIELDS = `--OAK-SERVER-BOUNDARY--\r\n`;

const FIXTURE_BODY_UTF8_FILENAME =
  `--OAK-SERVER-BOUNDARY\r\nContent-Disposition: form-data; name="id"\r\n\r\n555\r\n--OAK-SERVER-BOUNDARY\r\nContent-Disposition: form-data; name="filea"; filename="编写软件很难.ts"\r\nContent-Type: video/mp2t\r\n\r\nexport { printHello } from "./print_hello.ts";\n\r\n--OAK-SERVER-BOUNDARY--\r\n`;

const FIXTURE_BODY_NO_NEWLINE =
  `--OAK-SERVER-BOUNDARY\r\nContent-Disposition: form-data; name="noNewline"; filename="noNewline.txt"\r\nContent-Type: text/plain\r\n\r\n555\r\n--OAK-SERVER-BOUNDARY--\r\n`;

function assertIsFile(value: unknown): asserts value is File {
  if (
    !(value && typeof value === "object" && "size" in value &&
      "type" in value && "name" in value)
  ) {
    throw new Error("Value is not a File");
  }
}

Deno.test({
  name: "form_data - parse() - basic",
  async fn() {
    const req = new Request("http://localhost:8080", {
      body: FIXTURE_BODY,
      method: "POST",
      headers: { "content-type": FIXTURE_CONTENT_TYPE },
    });
    const formData = await parse(req.headers.get("content-type")!, req.body!);
    assertEquals([...formData].length, 3, "length should be 3");
    assertEquals(formData.get("id"), "555", "id should be '555'");
    assertEquals(
      formData.get("title"),
      "Hello\nWorld\n",
      "title should be 'Hello World'",
    );
    const fileb = formData.get("fileb");
    assertIsFile(fileb);
    assertEquals(fileb.type, "video/mp2t", "should be of type 'video/mp2t'");
    assertEquals(fileb.name, "mod2.ts", "filename should be 'mod2.ts'");
    assertEquals(
      await fileb.text(),
      `console.log("Hello world");\n`,
      "file contents should match",
    );
  },
});

Deno.test({
  name: "form_data - parse() - no fields",
  async fn() {
    const req = new Request("http://localhost:8080", {
      body: FIXTURE_BODY_NO_FIELDS,
      method: "POST",
      headers: { "content-type": FIXTURE_CONTENT_TYPE },
    });
    const formData = await parse(req.headers.get("content-type")!, req.body!);
    assertEquals([...formData].length, 0);
  },
});

Deno.test({
  name: "form_data - parse() - mbc file name",
  async fn() {
    const req = new Request("http://localhost:8080", {
      body: FIXTURE_BODY_UTF8_FILENAME,
      method: "POST",
      headers: { "content-type": FIXTURE_CONTENT_TYPE },
    });
    const formData = await parse(req.headers.get("content-type")!, req.body!);
    assertEquals([...formData].length, 2);
    const filea = formData.get("filea");
    assertIsFile(filea);
    assertEquals(filea.type, "video/mp2t");
    assertEquals(filea.name, "编写软件很难.ts");
  },
});

Deno.test({
  name: "for_data - parse() - no new line",
  async fn() {
    const req = new Request("http://localhost:8080", {
      body: FIXTURE_BODY_NO_NEWLINE,
      method: "POST",
      headers: { "content-type": FIXTURE_CONTENT_TYPE },
    });
    const formData = await parse(req.headers.get("content-type")!, req.body!);
    assertEquals([...formData].length, 1);
    const noNewline = formData.get("noNewline");
    assertIsFile(noNewline);
    assertEquals(await noNewline.text(), "555");
  },
});
