#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { build } from "https://deno.land/x/dnt@0.7.0/mod.ts";

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  package: {
    name: "@oakserver/oak",
    version: Deno.args[0],
    description:
      "A middleware framework for handling HTTP with Deno and Node.js",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/oakserver/oak.git",
    },
    bugs: {
      url: "https://github.com/oakserver/oak/issues",
    },
  },
});

await Deno.copyFile("LICENSE", "npm/LICENSE");
await Deno.copyFile("README.md", "npm/README.md");
