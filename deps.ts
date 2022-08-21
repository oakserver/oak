// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// `std` dependencies

export {
  type Deferred,
  deferred,
} from "https://deno.land/std@0.152.0/async/deferred.ts";
export {
  concat,
  copy as copyBytes,
  equals,
} from "https://deno.land/std@0.152.0/bytes/mod.ts";
export { timingSafeEqual } from "https://deno.land/std@0.152.0/crypto/timing_safe_equal.ts";
export * as base64 from "https://deno.land/std@0.152.0/encoding/base64.ts";
export {
  createHttpError,
  errors,
  HttpError,
  isHttpError,
} from "https://deno.land/std@0.152.0/http/http_errors.ts";
export {
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@0.152.0/http/http_status.ts";
export {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
} from "https://deno.land/std@0.152.0/http/negotiation.ts";
export { LimitedReader } from "https://deno.land/std@0.152.0/io/readers.ts";
export {
  contentType,
  extension,
  typeByExtension,
} from "https://deno.land/std@0.152.0/media_types/mod.ts";
export {
  readAll,
  readerFromStreamReader,
  writeAll,
} from "https://deno.land/std@0.152.0/streams/conversion.ts";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  sep,
} from "https://deno.land/std@0.152.0/path/mod.ts";

// 3rd party dependencies

export {
  compile,
  type Key,
  match as pathMatch,
  parse as pathParse,
  type ParseOptions,
  pathToRegexp,
  type TokensToRegexpOptions,
} from "https://deno.land/x/path_to_regexp@v6.2.1/index.ts";
