// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// jsr dependencies

export { assert } from "jsr:@std/assert@0.218/assert";
export { concat } from "jsr:@std/bytes@0.218/concat";
export { copy as copyBytes } from "jsr:@std/bytes@0.218/copy";
export { timingSafeEqual } from "jsr:@std/crypto@0.218/timing_safe_equal";
export { KeyStack } from "jsr:@std/crypto@0.218/unstable_keystack";
export { encodeBase64 } from "jsr:@std/encoding@0.218/base64";
export {
  calculate,
  type ETagOptions,
  type FileInfo,
  ifMatch,
  ifNoneMatch,
} from "jsr:@std/http@0.218/etag";
export {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
} from "jsr:@std/http@0.218/negotiation";
export { UserAgent } from "jsr:@std/http@0.218/user_agent";
export { LimitedReader } from "jsr:@std/io@0.218/limited_reader";
export { readAll } from "jsr:@std/io@0.218/read_all";
export { contentType } from "jsr:@std/media-types@0.218/content_type";
export { typeByExtension } from "jsr:@std/media-types@0.218/type_by_extension";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  SEPARATOR,
} from "jsr:@std/path@0.218/";

// 3rd party dependencies

export {
  mergeHeaders,
  SecureCookieMap,
  type SecureCookieMapGetOptions,
  type SecureCookieMapSetDeleteOptions,
} from "jsr:@oak/commons@0.6/cookie_map";
export {
  createHttpError,
  errors,
  HttpError,
  type HttpErrorOptions,
  isHttpError,
} from "jsr:@oak/commons@0.6/http_errors";
export { matches } from "jsr:@oak/commons@0.6/media_types";
export { type HttpMethod as HTTPMethods } from "jsr:@oak/commons@0.6/method";
export {
  ServerSentEvent,
  type ServerSentEventInit,
  ServerSentEventStreamTarget,
  type ServerSentEventTarget,
  type ServerSentEventTargetOptions,
} from "jsr:@oak/commons@0.6/server_sent_event";
export {
  type ErrorStatus,
  isErrorStatus,
  isRedirectStatus,
  type RedirectStatus,
  Status,
  STATUS_TEXT,
} from "jsr:@oak/commons@0.6/status";

export {
  compile,
  type Key,
  match as pathMatch,
  parse as pathParse,
  type ParseOptions,
  pathToRegexp,
  type TokensToRegexpOptions,
} from "npm:path-to-regexp@6.2.1";
