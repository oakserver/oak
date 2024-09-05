// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// jsr dependencies

export { assert } from "jsr:@std/assert@^1.0/assert";
export { concat } from "jsr:@std/bytes@^1.0/concat";
export { copy as copyBytes } from "jsr:@std/bytes@^1.0/copy";
export { timingSafeEqual } from "jsr:@std/crypto@^1.0/timing-safe-equal";
export {
  eTag,
  type ETagOptions,
  type FileInfo,
  ifMatch,
  ifNoneMatch,
} from "jsr:@std/http@^1.0/etag";
export {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
} from "jsr:@std/http@^1.0/negotiation";
export { UserAgent } from "jsr:@std/http@^1.0/user-agent";
export { LimitedReader } from "jsr:@std/io@0.224/limited-reader";
export { readAll } from "jsr:@std/io@0.224/read-all";
export { contentType } from "jsr:@std/media-types@^1.0/content-type";
export { typeByExtension } from "jsr:@std/media-types@^1.0/type-by-extension";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  SEPARATOR,
} from "jsr:@std/path@^1.0/";

// 3rd party dependencies

export {
  mergeHeaders,
  SecureCookieMap,
  type SecureCookieMapGetOptions,
  type SecureCookieMapSetDeleteOptions,
} from "jsr:@oak/commons@^1.0/cookie_map";
export { parse as parseFormData } from "jsr:@oak/commons@^1.0/form_data";
export { parse as parseForwarded } from "jsr:@oak/commons@^1.0/forwarded";
export {
  createHttpError,
  errors,
  HttpError,
  type HttpErrorOptions,
  isHttpError,
} from "jsr:@oak/commons@^1.0/http_errors";
export { KeyStack } from "jsr:@oak/commons@^1.0/keystack";
export { matches } from "jsr:@oak/commons@^1.0/media_types";
export { type HttpMethod as HTTPMethods } from "jsr:@oak/commons@^1.0/method";
export {
  type ByteRange,
  range,
  responseRange,
} from "jsr:@oak/commons@^1.0/range";
export {
  ServerSentEvent,
  type ServerSentEventInit,
  ServerSentEventStreamTarget,
  type ServerSentEventTarget,
  type ServerSentEventTargetOptions,
} from "jsr:@oak/commons@^1.0/server_sent_event";
export {
  type ErrorStatus,
  isErrorStatus,
  isRedirectStatus,
  type RedirectStatus,
  Status,
  STATUS_TEXT,
} from "jsr:@oak/commons@^1.0/status";

export {
  compile,
  type Key,
  match as pathMatch,
  parse as pathParse,
  type ParseOptions,
  pathToRegexp,
  type TokensToRegexpOptions,
} from "npm:path-to-regexp@6.2.1";
