// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// `std` dependencies

export {
  concat,
  copy as copyBytes,
  equals,
} from "https://raw.githubusercontent.com/denoland/deno_std/main/bytes/mod.ts";
export * as base64 from "https://raw.githubusercontent.com/denoland/deno_std/main/encoding/base64.ts";
export {
  Status,
  STATUS_TEXT,
} from "https://raw.githubusercontent.com/denoland/deno_std/main/http/http_status.ts";
export { LimitedReader } from "https://raw.githubusercontent.com/denoland/deno_std/main/io/readers.ts";
export { readerFromStreamReader } from "https://raw.githubusercontent.com/denoland/deno_std/main/streams/conversion.ts";
export {
  readAll,
  writeAll,
} from "https://raw.githubusercontent.com/denoland/deno_std/main/io/util.ts";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  sep,
} from "https://raw.githubusercontent.com/denoland/deno_std/main/path/mod.ts";

// 3rd party dependencies

export {
  contentType,
  extension,
  lookup,
} from "https://deno.land/x/media_types@v2.12.1/mod.ts";
export {
  compile,
  match as pathMatch,
  parse as pathParse,
  pathToRegexp,
} from "https://deno.land/x/path_to_regexp@v6.2.0/index.ts";
export type {
  Key,
  ParseOptions,
  TokensToRegexpOptions,
} from "https://deno.land/x/path_to_regexp@v6.2.0/index.ts";
