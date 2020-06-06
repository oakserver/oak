// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { assertEquals, StringReader, test } from "./test_deps.ts";

import { BufReader } from "./buf_reader.ts";

const decoder = new TextDecoder();

const fixture = `Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed
diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat
volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper
suscipit lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum
iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum
dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio
dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te
feugait nulla facilisi.

Epsum factorial non deposit quid pro quo hic escorol. Olypian quarrels et
gorilla congolium sic ad nauseum. Souvlaki ignitus carborundum e pluribus unum.
Defacto lingo est igpay atinlay. Marquee selectus non provisio incongruous
feline nolo contendre. Gratuitous octopus niacin, sodium glutimate. Quote meon
an estimate et non interruptus stadium. Sic tempus fugit esperanto hiccup
estrogen. Glorious baklava ex librus hup hey ad infinitum. Non sequitur
condominium facile et geranium incognito. Epsum factorial non deposit quid pro
quo hic escorol. Marquee selectus non provisio incongruous feline nolo contendre
Olypian quarrels et gorilla congolium sic ad nauseum. Souvlaki ignitus
carborundum e pluribus unum.
`;

function append(a: Uint8Array, b: Uint8Array): Uint8Array {
  const ab = new Uint8Array(a.length + b.length);
  ab.set(a, 0);
  ab.set(b, a.length);
  return ab;
}

test({
  name: "BufReader - readLine()",
  async fn() {
    const reader = new StringReader(fixture);
    const bufReader = new BufReader(reader, 100);
    let reads = 0;
    let actual = new Uint8Array();
    let readResult: { bytes: Uint8Array; eol: boolean } | null;
    while ((readResult = await bufReader.readLine(false))) {
      reads++;
      actual = append(actual, readResult.bytes);
    }
    assertEquals(decoder.decode(actual), fixture);
    assertEquals(reads, 19);
  },
});
