// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// `std` dependencies

export { assert } from "https://deno.land/std@0.217.0/assert/assert.ts";
export { concat } from "https://deno.land/std@0.217.0/bytes/concat.ts";
export { copy as copyBytes } from "https://deno.land/std@0.217.0/bytes/copy.ts";
export { timingSafeEqual } from "https://deno.land/std@0.217.0/crypto/timing_safe_equal.ts";
export { KeyStack } from "https://deno.land/std@0.217.0/crypto/unstable_keystack.ts";
export { encodeBase64 } from "https://deno.land/std@0.217.0/encoding/base64.ts";
export {
  calculate,
  type ETagOptions,
  type FileInfo,
  ifMatch,
  ifNoneMatch,
} from "https://deno.land/std@0.217.0/http/etag.ts";
export {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
} from "https://deno.land/std@0.217.0/http/negotiation.ts";
export { UserAgent } from "https://deno.land/std@0.217.0/http/user_agent.ts";
export { LimitedReader } from "https://deno.land/std@0.217.0/io/limited_reader.ts";
export { readAll } from "https://deno.land/std@0.217.0/io/read_all.ts";
export { contentType } from "https://deno.land/std@0.217.0/media_types/content_type.ts";
export { typeByExtension } from "https://deno.land/std@0.217.0/media_types/type_by_extension.ts";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  SEPARATOR,
} from "https://deno.land/std@0.217.0/path/mod.ts";

// 3rd party dependencies

export {
  mergeHeaders,
  SecureCookieMap,
  type SecureCookieMapGetOptions,
  type SecureCookieMapSetDeleteOptions,
} from "https://deno.land/x/oak_commons@0.6.1/cookie_map.ts";
export {
  createHttpError,
  errors,
  HttpError,
  type HttpErrorOptions,
  isHttpError,
} from "https://deno.land/x/oak_commons@0.6.1/http_errors.ts";
export { matches } from "https://deno.land/x/oak_commons@0.6.1/media_types.ts";
export { type HttpMethod as HTTPMethods } from "https://deno.land/x/oak_commons@0.6.1/method.ts";
export {
  ServerSentEvent,
  type ServerSentEventInit,
  ServerSentEventStreamTarget,
  type ServerSentEventTarget,
  type ServerSentEventTargetOptions,
} from "https://deno.land/x/oak_commons@0.6.1/server_sent_event.ts";
export {
  type ErrorStatus,
  isErrorStatus,
  isRedirectStatus,
  type RedirectStatus,
  Status,
  STATUS_TEXT,
} from "https://deno.land/x/oak_commons@0.6.1/status.ts";

export {
  compile,
  type Key,
  match as pathMatch,
  parse as pathParse,
  type ParseOptions,
  pathToRegexp,
  type TokensToRegexpOptions,
} from "https://deno.land/x/path_to_regexp@v6.2.1/index.ts";
