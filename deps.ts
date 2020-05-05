// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

export {
  HTTPOptions,
  HTTPSOptions,
  Response,
  serve,
  Server,
  ServerRequest,
  serveTLS,
} from "https://deno.land/std@v1.0.0-rc1/http/server.ts";
export {
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@v1.0.0-rc1/http/http_status.ts";
export {
  Cookies,
  Cookie,
  setCookie,
  getCookies,
  delCookie,
} from "https://deno.land/std@v1.0.0-rc1/http/cookie.ts";
export {
  basename,
  extname,
  join,
  isAbsolute,
  normalize,
  parse,
  resolve,
  sep,
} from "https://deno.land/std@v1.0.0-rc1/path/mod.ts";
export { HmacSha256 } from "https://deno.land/std@v1.0.0-rc1/util/sha256.ts";
export { assert } from "https://deno.land/std@v1.0.0-rc1/testing/asserts.ts";
export {
  contentType,
  lookup,
} from "https://deno.land/x/media_types@v2.0.0/mod.ts";
