#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env --allow-run
// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

/**
 * This is the build script for building the oak framework into a Node.js
 * compatible npm package.
 *
 * @module
 */

import { build, emptyDir } from "https://deno.land/x/dnt@0.30.0/mod.ts";
import { copy } from "https://deno.land/std@0.152.0/fs/copy.ts";

async function start() {
  await emptyDir("./npm");
  await copy("fixtures", "npm/esm/fixtures", { overwrite: true });
  await copy("fixtures", "npm/script/fixtures", { overwrite: true });

  await build({
    entryPoints: ["./mod.ts"],
    outDir: "./npm",
    mappings: {
      "./http_server_native.ts": "./http_server_node.ts",
    },
    shims: {
      blob: true,
      crypto: true,
      deno: true,
      undici: true,
      custom: [{
        package: {
          name: "stream/web",
        },
        globalNames: ["ReadableStream", "TransformStream"],
      }, {
        module: "./node_shims.ts",
        globalNames: ["ErrorEvent"],
      }],
    },
    test: true,
    typeCheck: false,
    compilerOptions: {
      importHelpers: true,
      target: "ES2021",
      lib: ["esnext", "dom", "dom.iterable"],
    },
    package: {
      name: "@oakserver/oak",
      version: Deno.args[0],
      description: "A middleware framework for handling HTTP requests",
      license: "MIT",
      engines: {
        node: ">=16.5.0 <19",
      },
      repository: {
        type: "git",
        url: "git+https://github.com/oakserver/oak.git",
      },
      bugs: {
        url: "https://github.com/oakserver/oak/issues",
      },
      dependencies: {
        "tslib": "~2.3.1",
      },
      devDependencies: {
        "@types/node": "^17",
      },
    },
  });

  await Deno.copyFile("LICENSE", "npm/LICENSE");
  await Deno.copyFile("README.md", "npm/README.md");
}

start();
