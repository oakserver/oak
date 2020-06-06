import { getFilename } from "./content_disposition.ts";
import { assertEquals } from "./test_deps.ts";

const tests: [string, string][] = [
  ['filename="file.ext"', "file.ext"],
  ['attachment; filename="file.ext"', "file.ext"],
  ['attachment; filename="file.ext"; dummy', "file.ext"],
  ["attachment", ""],
  ["attachement; filename*=UTF-8'en-US'hello.txt", "hello.txt"],
  ['attachement; filename*0="hello"; filename*1="world.txt"', "helloworld.txt"],
  ['attachment; filename="A.ext"; filename*="B.ext"', "B.ext"],
  [
    'attachment; filename*="A.ext"; filename*0="B"; filename*1="B.ext"',
    "A.ext",
  ],
  ["attachment; filename=\xe5\x9c\x8b.pdf", "\u570b.pdf"],
  ["attachment; filename=okre\x9clenia.rtf", "okreœlenia.rtf"],
  ["attachment; filename*=ISO-8859-1''%c3%a4", "\u00c3\u00a4"],
  [
    "attachment; filename*0*=ISO-8859-15''euro-sign%3d%a4; filename*=ISO-8859-1''currency-sign%3d%a4",
    "currency-sign=\u00a4",
  ],
  ['INLINE; FILENAME*= "an example.html"', "an example.html"],
];

for (const [fixture, expected] of tests) {
  Deno.test({
    name: `content_disposition - getFilename("${fixture}")`,
    fn() {
      const actual = getFilename(fixture);
      assertEquals(actual, expected);
    },
  });
}
