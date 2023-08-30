// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// `std` dependencies

export {
  type Deferred,
  deferred,
} from "https://deno.land/std@0.200.0/async/deferred.ts";
export {
  concat,
  copy as copyBytes,
  equals,
} from "https://deno.land/std@0.200.0/bytes/mod.ts";
export { timingSafeEqual } from "https://deno.land/std@0.200.0/crypto/timing_safe_equal.ts";
export { KeyStack } from "https://deno.land/std@0.200.0/crypto/keystack.ts";
export * as base64 from "https://deno.land/std@0.200.0/encoding/base64.ts";
export {
  mergeHeaders,
  SecureCookieMap,
  type SecureCookieMapGetOptions,
  type SecureCookieMapSetDeleteOptions,
} from "https://deno.land/std@0.200.0/http/cookie_map.ts";
export {
  createHttpError,
  errors,
  HttpError,
  type HttpErrorOptions,
  isHttpError,
} from "https://deno.land/std@0.200.0/http/http_errors.ts";
export {
  type ErrorStatus,
  isErrorStatus,
  isRedirectStatus,
  type RedirectStatus,
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@0.200.0/http/http_status.ts";
export {
  calculate,
  type ETagOptions,
  type FileInfo,
  ifMatch,
  ifNoneMatch,
} from "https://deno.land/std@0.200.0/http/etag.ts";
export { type HttpMethod as HTTPMethods } from "https://deno.land/std@0.200.0/http/method.ts";
export {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
} from "https://deno.land/std@0.200.0/http/negotiation.ts";
export {
  ServerSentEvent,
  type ServerSentEventInit,
  ServerSentEventStreamTarget,
  type ServerSentEventTarget,
  type ServerSentEventTargetOptions,
} from "https://deno.land/std@0.200.0/http/server_sent_event.ts";
export { UserAgent } from "https://deno.land/std@0.200.0/http/user_agent.ts";
export { LimitedReader } from "https://deno.land/std@0.200.0/io/mod.ts";
export {
  contentType,
  extension,
  typeByExtension,
} from "https://deno.land/std@0.200.0/media_types/mod.ts";
export {
  readAll,
  readerFromStreamReader,
  writeAll,
} from "https://deno.land/std@0.200.0/streams/mod.ts";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  SEP,
} from "https://deno.land/std@0.200.0/path/mod.ts";

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
