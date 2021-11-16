// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// `std` dependencies

export {
  concat,
  copy as copyBytes,
  equals,
} from "./deps/deno_land/std_0.114.0/bytes/mod.js";
export * as base64 from "./deps/deno_land/std_0.114.0/encoding/base64.js";
export {
  Status,
  STATUS_TEXT,
} from "./deps/deno_land/std_0.114.0/http/http_status.js";
export { LimitedReader } from "./deps/deno_land/std_0.114.0/io/readers.js";
export { readerFromStreamReader } from "./deps/deno_land/std_0.114.0/streams/conversion.js";
export { readAll, writeAll } from "./deps/deno_land/std_0.114.0/io/util.js";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  sep,
} from "./deps/deno_land/std_0.114.0/path/mod.js";

// 3rd party dependencies

export {
  contentType,
  extension,
  lookup,
} from "./deps/deno_land/x/media_types_v2.11.0/mod.js";
export {
  compile,
  match as pathMatch,
  parse as pathParse,
  pathToRegexp,
} from "./deps/deno_land/x/path_to_regexp_v6.2.0/index.js";
export type {
  Key,
  ParseOptions,
  TokensToRegexpOptions,
} from "./deps/deno_land/x/path_to_regexp_v6.2.0/index.js";
