// This file contains the external dependencies that oak depends upon

export { serve } from "https://deno.land/x/std@v0.2.4/net/http.ts";
export {
  Status,
  STATUS_TEXT
} from "https://deno.land/x/std@v0.2.4/net/http_status.ts";
export {
  basename,
  extname,
  join,
  isAbsolute,
  normalize,
  parse,
  resolve,
  sep
} from "https://deno.land/x/std@v0.2.4/path/index.ts";

interface MimeDB {
  [mediaType: string]: {
    source?: string;
    compressible?: boolean;
    charset?: string;
    extensions?: string[];
  };
}

import * as db from "https://raw.githubusercontent.com/jshttp/mime-db/v1.37.0/db.json";
export const mimeDB: MimeDB = db;
