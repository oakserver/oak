// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { test, assertEquals, assertStrictEq } from "./test_deps.ts";
import {
  Key,
  ParseOptions,
  Path,
  pathToRegExp,
  RegExpOptions,
} from "./pathToRegExp.ts";

interface TestFixture {
  name: string;
  source: Path;
  options?: RegExpOptions & ParseOptions;
  keys?: Key[];
  fixtures: {
    [value: string]: string[] | null;
  };
}

const testFixtures: TestFixture[] = [
  {
    name: "/",
    source: "/",
    fixtures: {
      "/": ["/"],
      "/route": null,
    },
  },
  {
    name: "/test",
    source: "/test",
    fixtures: {
      "/test": ["/test"],
      "/route": null,
      "/test/route": null,
      "/test/": ["/test/"],
    },
  },
  {
    name: "/test/",
    source: "/test/",
    fixtures: {
      "/test": null,
      "/test/": ["/test/"],
      "/test//": ["/test//"],
    },
  },
  {
    name: "/test sensitive",
    source: "/test",
    options: { sensitive: true },
    fixtures: {
      "/test": ["/test"],
      "/TEST": null,
    },
  },
  {
    name: "/TEST sensitive",
    source: "/TEST",
    options: { sensitive: true },
    fixtures: {
      "/test": null,
      "/TEST": ["/TEST"],
    },
  },
  {
    name: "/test strict",
    source: "/test",
    options: {
      strict: true,
    },
    fixtures: {
      "/test": ["/test"],
      "/test/": null,
      "/TEST": ["/TEST"],
    },
  },
  {
    name: "/test/ strict",
    source: "/test/",
    options: {
      strict: true,
    },
    fixtures: {
      "/test": null,
      "/test/": ["/test/"],
      "/test//": null,
    },
  },
  {
    name: "/test non-ending",
    source: "/test",
    options: {
      end: false,
    },
    fixtures: {
      "/test": ["/test"],
      "/test/": ["/test/"],
      "/test/route": ["/test"],
      "/route": null,
    },
  },
  {
    name: "/test/ non-ending",
    source: "/test/",
    options: {
      end: false,
    },
    fixtures: {
      "/test": null,
      "/test/route": ["/test/"],
      "/test//": ["/test//"],
      "/test//route": ["/test/"],
    },
  },
  {
    name: "/:test non-ending",
    source: "/:test",
    options: {
      end: false,
    },
    keys: [
      {
        name: "test",
        prefix: "/",
        delimiter: "/",
        optional: false,
        repeat: false,
        pattern: "[^\\/]+?",
        partial: false,
      },
    ],
    fixtures: {
      "/route": ["/route", "route"],
    },
  },
  {
    name: "/:test/ non-ending",
    source: "/:test/",
    options: {
      end: false,
    },
    keys: [
      {
        name: "test",
        prefix: "/",
        delimiter: "/",
        optional: false,
        repeat: false,
        pattern: "[^\\/]+?",
        partial: false,
      },
    ],
    fixtures: {
      "/route": null,
      "/route/": ["/route/", "route"],
    },
  },
  {
    name: "empty non-ending",
    source: "",
    options: {
      end: false,
    },
    fixtures: {
      "": [""],
      "/": ["/"],
      route: [""],
      "/route": [""],
      "/route/": [""],
    },
  },
  {
    name: "/test non-starting",
    source: "/test",
    options: {
      start: false,
    },
    fixtures: {
      "/test": ["/test"],
      "/test/": ["/test/"],
      "/route/test": ["/test"],
      "/test/route": null,
      "/route/test/deep": null,
      "/route": null,
    },
  },
  {
    name: "/test/ non-starting",
    source: "/test/",
    options: {
      start: false,
    },
    fixtures: {
      "/test": null,
      "/test/route": null,
      "/test//route": null,
      "/test//": ["/test//"],
      "/route/test/": ["/test/"],
    },
  },
  {
    name: "/:test non-starting",
    source: "/:test",
    options: {
      start: false,
    },
    keys: [
      {
        name: "test",
        prefix: "/",
        delimiter: "/",
        optional: false,
        repeat: false,
        pattern: "[^\\/]+?",
        partial: false,
      },
    ],
    fixtures: {
      "/route": ["/route", "route"],
    },
  },
  {
    name: "/:test/ non-starting",
    source: "/:test/",
    options: {
      start: false,
    },
    keys: [
      {
        name: "test",
        prefix: "/",
        delimiter: "/",
        optional: false,
        repeat: false,
        pattern: "[^\\/]+?",
        partial: false,
      },
    ],
    fixtures: {
      "/route": null,
      "/route/": ["/route/", "route"],
    },
  },
  {
    name: "empty non-starting",
    source: "",
    options: {
      start: false,
    },
    fixtures: {
      "": [""],
      "/": ["/"],
      route: [""],
      "/route": [""],
      "/route/": ["/"],
    },
  },
  {
    name: "/one /two array",
    source: ["/one", "/two"],
    fixtures: {
      "/one": ["/one"],
      "/two": ["/two"],
      "/three": null,
      "/one/two": null,
    },
  },
  {
    name: "/:test",
    source: "/:test",
    keys: [
      {
        name: "test",
        prefix: "/",
        delimiter: "/",
        optional: false,
        repeat: false,
        pattern: "[^\\/]+?",
        partial: false,
      },
    ],
    fixtures: {
      "/route": ["/route", "route"],
      "/another": ["/another", "another"],
      "/something/else": null,
      "/route.json": ["/route.json", "route.json"],
      "/something%2Felse": ["/something%2Felse", "something%2Felse"],
      "/something%2Felse%2Fmore": [
        "/something%2Felse%2Fmore",
        "something%2Felse%2Fmore",
      ],
      "/;,:@&=+$-_.!~*()": ["/;,:@&=+$-_.!~*()", ";,:@&=+$-_.!~*()"],
    },
  },
];

for (const { name, source, fixtures, keys, options } of testFixtures) {
  test({
    name: `pathToRegExp ${name}`,
    fn() {
      const actualKeys: Key[] = [];
      const re = pathToRegExp(source, actualKeys, options);
      if (keys) {
        assertEquals(actualKeys, keys);
      } else {
        assertEquals(actualKeys.length, 0);
      }
      for (const [fixture, expected] of Object.entries(fixtures)) {
        const actual = re.exec(fixture);
        if (!actual) {
          assertStrictEq(expected, null, "Expected a match.");
        } else {
          assertEquals([...actual], expected);
        }
      }
    },
  });
}
