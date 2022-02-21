// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// `std` dependencies

export {
  concat,
  copy as copyBytes,
  equals,
} from "https://deno.land/std@0.126.0/bytes/mod.ts";
export * as base64 from "https://deno.land/std@0.126.0/encoding/base64.ts";
export {
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@0.126.0/http/http_status.ts";
export { LimitedReader } from "https://deno.land/std@0.126.0/io/readers.ts";
export {
  readAll,
  readerFromStreamReader,
  writeAll,
} from "https://deno.land/std@0.126.0/streams/conversion.ts";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  sep,
} from "https://deno.land/std@0.126.0/path/mod.ts";

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
