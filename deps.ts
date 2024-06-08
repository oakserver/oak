// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// jsr dependencies

export { assert } from "jsr:@std/assert@0.223/assert";
export { concat } from "jsr:@std/bytes@0.223/concat";
export { copy as copyBytes } from "jsr:@std/bytes@0.223/copy";
export { timingSafeEqual } from "jsr:@std/crypto@0.223/timing-safe-equal";
export { KeyStack } from "jsr:@std/crypto@0.223/unstable-keystack";
export {
  calculate,
  type ETagOptions,
  type FileInfo,
  ifMatch,
  ifNoneMatch,
} from "jsr:@std/http@0.223/etag";
export {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
} from "jsr:@std/http@0.223/negotiation";
export { UserAgent } from "jsr:@std/http@0.223/user-agent";
export { LimitedReader } from "jsr:@std/io@0.223/limited-reader";
export { readAll } from "jsr:@std/io@0.223/read-all";
export { contentType } from "jsr:@std/media-types@0.223/content-type";
export { typeByExtension } from "jsr:@std/media-types@0.223/type-by-extension";
export {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  SEPARATOR,
} from "jsr:@std/path@0.223/";

// 3rd party dependencies

export {
  mergeHeaders,
  SecureCookieMap,
  type SecureCookieMapGetOptions,
  type SecureCookieMapSetDeleteOptions,
} from "jsr:@oak/commons@0.11/cookie_map";
export { parse as parseFormData } from "jsr:@oak/commons@0.11/form_data";
export { parse as parseForwarded } from "jsr:@oak/commons@0.11/forwarded";
export {
  createHttpError,
  errors,
  HttpError,
  type HttpErrorOptions,
  isHttpError,
} from "jsr:@oak/commons@0.11/http_errors";
export { matches } from "jsr:@oak/commons@0.11/media_types";
export { type HttpMethod as HTTPMethods } from "jsr:@oak/commons@0.11/method";
export {
  type ByteRange,
  range,
  responseRange,
} from "jsr:@oak/commons@0.11/range";
export {
  ServerSentEvent,
  type ServerSentEventInit,
  ServerSentEventStreamTarget,
  type ServerSentEventTarget,
  type ServerSentEventTargetOptions,
} from "jsr:@oak/commons@0.11/server_sent_event";
export {
  type ErrorStatus,
  isErrorStatus,
  isRedirectStatus,
  type RedirectStatus,
  Status,
  STATUS_TEXT,
} from "jsr:@oak/commons@0.11/status";

export {
  compile,
  type Key,
  match as pathMatch,
  parse as pathParse,
  type ParseOptions,
  pathToRegexp,
  type TokensToRegexpOptions,
} from "npm:path-to-regexp@6.2.1";
