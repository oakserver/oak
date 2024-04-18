// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// jsr dependencies

export { assert } from "jsr:@std/assert@0.222/assert";
export { concat } from "jsr:@std/bytes@0.222/concat";
export { copy as copyBytes } from "jsr:@std/bytes@0.222/copy";
export { timingSafeEqual } from "jsr:@std/crypto@0.222/timing-safe-equal";
export { KeyStack } from "jsr:@std/crypto@0.222/unstable-keystack";
export {
  calculate,
  type ETagOptions,
  type FileInfo,
  ifMatch,
  ifNoneMatch,
} from "jsr:@std/http@0.222/etag";
export {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
} from "jsr:@std/http@0.222/negotiation";
export { UserAgent } from "jsr:@std/http@0.222/user-agent";
export { LimitedReader } from "jsr:@std/io@0.222/limited-reader";
export { readAll } from "jsr:@std/io@0.222/read-all";
export { contentType } from "jsr:@std/media-types@0.222/content-type";
export { typeByExtension } from "jsr:@std/media-types@0.222/type-by-extension";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  SEPARATOR,
} from "jsr:@std/path@0.222/";

// 3rd party dependencies

export {
  mergeHeaders,
  SecureCookieMap,
  type SecureCookieMapGetOptions,
  type SecureCookieMapSetDeleteOptions,
} from "jsr:@oak/commons@0.10/cookie_map";
export { parse as parseFormData } from "jsr:@oak/commons@0.10/form_data";
export {
  createHttpError,
  errors,
  HttpError,
  type HttpErrorOptions,
  isHttpError,
} from "jsr:@oak/commons@0.10/http_errors";
export { matches } from "jsr:@oak/commons@0.10/media_types";
export { type HttpMethod as HTTPMethods } from "jsr:@oak/commons@0.10/method";
export {
  type ByteRange,
  range,
  responseRange,
} from "jsr:@oak/commons@0.10/range";
export {
  ServerSentEvent,
  type ServerSentEventInit,
  ServerSentEventStreamTarget,
  type ServerSentEventTarget,
  type ServerSentEventTargetOptions,
} from "jsr:@oak/commons@0.10/server_sent_event";
export {
  type ErrorStatus,
  isErrorStatus,
  isRedirectStatus,
  type RedirectStatus,
  Status,
  STATUS_TEXT,
} from "jsr:@oak/commons@0.10/status";

export {
  compile,
  type Key,
  match as pathMatch,
  parse as pathParse,
  type ParseOptions,
  pathToRegexp,
  type TokensToRegexpOptions,
} from "npm:path-to-regexp@6.2.1";
