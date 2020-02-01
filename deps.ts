// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

export {
  Response,
  serve,
  Server,
  ServerRequest
} from "https://deno.land/std@v0.31.0/http/server.ts";
export {
  Status,
  STATUS_TEXT
} from "https://deno.land/std@v0.31.0/http/http_status.ts";
export {
  basename,
  extname,
  join,
  isAbsolute,
  normalize,
  parse,
  resolve,
  sep
} from "https://deno.land/std@v0.31.0/path/mod.ts";
export {
  contentType,
  lookup
} from "https://deno.land/std@v0.31.0/media_types/mod.ts";
