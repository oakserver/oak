#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env --allow-run
// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { build, emptyDir } from "https://deno.land/x/dnt@0.17.0/mod.ts";

async function start() {
  await emptyDir("./npm");

  await build({
    entryPoints: ["./mod.ts"],
    outDir: "./npm",
    shims: { deno: true },
    scriptModule: false,
    compilerOptions: {
      target: "ES2021",
    },
    package: {
      name: "@oakserver/oak",
      version: Deno.args[0],
      description: "A middleware framework for handling HTTP requests",
      license: "MIT",
      engines: {
        node: ">=16.5.0 <18",
      },
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
}

start();
