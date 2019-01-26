// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

// This file contains the external dependencies that oak depends upon

export {
  Response as ServerResponse,
  serve,
  ServerRequest
} from "https://deno.land/x/std@v0.2.7/http/mod.ts";
export {
  Status,
  STATUS_TEXT
} from "https://deno.land/x/std@v0.2.7/http/http_status.ts";
export {
  basename,
  extname,
  join,
  isAbsolute,
  normalize,
  parse,
  resolve,
  sep
} from "https://deno.land/x/std@v0.2.7/fs/path/mod.ts";
export { contentType } from "https://deno.land/x/std@v0.2.7/media_types/mod.ts";
