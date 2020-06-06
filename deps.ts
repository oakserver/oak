// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

// `std` dependencies

export { equal } from "https://deno.land/std@0.56.0/bytes/mod.ts";
export { Sha1 } from "https://deno.land/std@0.56.0/hash/sha1.ts";
export { HmacSha256 } from "https://deno.land/std@0.56.0/hash/sha256.ts";
export {
  Response,
  serve,
  Server,
  ServerRequest,
  serveTLS,
} from "https://deno.land/std@0.56.0/http/server.ts";
export {
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@0.56.0/http/http_status.ts";
export {
  Cookies,
  Cookie,
  setCookie,
  getCookies,
  delCookie,
} from "https://deno.land/std@0.56.0/http/cookie.ts";
export { copyBytes } from "https://deno.land/std@0.56.0/io/util.ts";
export {
  basename,
  extname,
  join,
  isAbsolute,
  normalize,
  parse,
  resolve,
  sep,
} from "https://deno.land/std@0.56.0/path/mod.ts";
export { assert } from "https://deno.land/std@0.56.0/testing/asserts.ts";
export {
  acceptable,
  acceptWebSocket,
  WebSocket,
} from "https://deno.land/std@0.56.0/ws/mod.ts";

// 3rd party dependencies

export {
  contentType,
  extension,
  lookup,
} from "https://deno.land/x/media_types@v2.3.5/mod.ts";
export {
  compile,
  Key,
  parse as pathParse,
  ParseOptions,
  pathToRegexp,
  TokensToRegexpOptions,
} from "https://raw.githubusercontent.com/pillarjs/path-to-regexp/v6.1.0/src/index.ts";
