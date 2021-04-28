/*!
 * Adapted from koa-send at https://github.com/koajs/send and which is licensed
 * with the MIT license.
 */

import type { Context } from "./context.ts";
import { calculate, FileInfo, ifNoneMatch } from "./etag.ts";
import { createHttpError } from "./httpError.ts";
import {
  assert,
  basename,
  extname,
  LimitedReader,
  parse,
  readAll,
  Status,
} from "./deps.ts";
import { ifRange, MultiPartStream, parseRange } from "./range.ts";
import type { Response } from "./response.ts";
import { decodeComponent, getBoundary, resolvePath } from "./util.ts";

const MAXBUFFER_DEFAULT = 1_048_576; // 1MiB;
const BOUNDARY = getBoundary();

export interface SendOptions {
  /** Try to serve the brotli version of a file automatically when brotli is
   * supported by a client and if the requested file with `.br` extension
   * exists. (defaults to `true`) */
  brotli?: boolean;

  /** Try to match extensions from passed array to search for file when no
   * extension is sufficed in URL. First found is served. (defaults to
   * `undefined`) */
  extensions?: string[];

  /** If `true`, format the path to serve static file servers and not require a
   * trailing slash for directories, so that you can do both `/directory` and
   * `/directory/`. (defaults to `true`) */
  format?: boolean;

  /** Try to serve the gzipped version of a file automatically when gzip is
   * supported by a client and if the requested file with `.gz` extension
   * exists. (defaults to `true`). */
  gzip?: boolean;

  /** Allow transfer of hidden files. (defaults to `false`) */
  hidden?: boolean;

  /** Tell the browser the resource is immutable and can be cached
   * indefinitely. (defaults to `false`) */
  immutable?: boolean;

  /** Name of the index file to serve automatically when visiting the root
   * location. (defaults to none) */
  index?: string;

  /** Browser cache max-age in milliseconds. (defaults to `0`) */
  maxage?: number;

  /** A size in bytes where if the file is less than this size, the file will
   * be read into memory by send instead of returning a file handle.  Files less
   * than the byte size will send an "strong" `ETag` header while those larger
   * than the bytes size will only be able to send a "weak" `ETag` header (as
   * they cannot hash the contents of the file). (defaults to 1MiB)
   */
  maxbuffer?: number;

  /** Root directory to restrict file access. */
  root: string;
}

function isHidden(path: string) {
  const pathArr = path.split("/");
  for (const segment of pathArr) {
    if (segment[0] === "." && segment !== "." && segment !== "..") {
      return true;
    }
    return false;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch {
    return false;
  }
}

async function getEntity(
  path: string,
  mtime: number,
  stats: Deno.FileInfo,
  maxbuffer: number,
  response: Response,
): Promise<[Uint8Array | Deno.File, Uint8Array | FileInfo]> {
  let body: Uint8Array | Deno.File;
  let entity: Uint8Array | FileInfo;
  const file = await Deno.open(path, { read: true });
  if (stats.size < maxbuffer) {
    const buffer = await readAll(file);
    file.close();
    body = entity = buffer;
  } else {
    response.addResource(file.rid);
    body = file;
    entity = {
      mtime: new Date(mtime!),
      size: stats.size,
    };
  }
  return [body, entity];
}

async function sendRange(
  response: Response,
  body: Uint8Array | Deno.File,
  range: string,
  size: number,
) {
  const ranges = parseRange(range, size);
  if (ranges.length === 0) {
    throw createHttpError(Status.RequestedRangeNotSatisfiable);
  }
  response.status = Status.PartialContent;
  if (ranges.length === 1) {
    const [byteRange] = ranges;
    response.headers.set(
      "Content-Length",
      String(byteRange.end - byteRange.start),
    );
    response.headers.set(
      "Content-Range",
      `bytes ${byteRange.start}-${byteRange.end}/${size}`,
    );
    if (body instanceof Uint8Array) {
      response.body = body.slice(byteRange.start, byteRange.end + 1);
    } else {
      await body.seek(byteRange.start, Deno.SeekMode.Start);
      response.body = new LimitedReader(body, byteRange.end - byteRange.start);
    }
  } else {
    assert(response.type);
    response.headers.set(
      "content-type",
      `multipart/byteranges; boundary=${BOUNDARY}`,
    );
    const multipartBody = new MultiPartStream(
      body,
      response.type,
      ranges,
      size,
      BOUNDARY,
    );
    response.headers.set(
      "content-length",
      String(multipartBody.contentLength()),
    );
    response.body = multipartBody;
  }
}

/** Asynchronously fulfill a response with a file from the local file
 * system.
 *
 * Requires Deno read permission for the `root` directory. */
export async function send(
  // deno-lint-ignore no-explicit-any
  { request, response }: Context<any>,
  path: string,
  options: SendOptions = { root: "" },
): Promise<string | undefined> {
  const {
    brotli = true,
    extensions,
    format = true,
    gzip = true,
    hidden = false,
    immutable = false,
    index,
    maxbuffer = MAXBUFFER_DEFAULT,
    maxage = 0,
    root,
  } = options;
  const trailingSlash = path[path.length - 1] === "/";
  path = decodeComponent(path.substr(parse(path).root.length));
  if (index && trailingSlash) {
    path += index;
  }

  if (!hidden && isHidden(path)) {
    throw createHttpError(403);
  }

  path = resolvePath(root, path);

  let encodingExt = "";
  if (
    brotli &&
    request.acceptsEncodings("br", "identity") === "br" &&
    (await exists(`${path}.br`))
  ) {
    path = `${path}.br`;
    response.headers.set("Content-Encoding", "br");
    response.headers.delete("Content-Length");
    encodingExt = ".br";
  } else if (
    gzip &&
    request.acceptsEncodings("gzip", "identity") === "gzip" &&
    (await exists(`${path}.gz`))
  ) {
    path = `${path}.gz`;
    response.headers.set("Content-Encoding", "gzip");
    response.headers.delete("Content-Length");
    encodingExt = ".gz";
  }

  if (extensions && !/\.[^/]*$/.exec(path)) {
    for (let ext of extensions) {
      if (!/^\./.exec(ext)) {
        ext = `.${ext}`;
      }
      if (await exists(`${path}${ext}`)) {
        path += ext;
        break;
      }
    }
  }

  let stats: Deno.FileInfo;
  try {
    stats = await Deno.stat(path);

    if (stats.isDirectory) {
      if (format && index) {
        path += `/${index}`;
        stats = await Deno.stat(path);
      } else {
        return;
      }
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw createHttpError(404, err.message);
    }
    throw createHttpError(500, err.message);
  }

  let mtime: number | null = null;
  if (response.headers.has("Last-Modified")) {
    mtime = new Date(response.headers.get("Last-Modified")!).getTime();
  } else if (stats.mtime) {
    // Round down to second because it's the precision of the UTC string.
    mtime = stats.mtime.getTime();
    mtime -= mtime % 1000;
    response.headers.set("Last-Modified", new Date(mtime).toUTCString());
  }

  if (!response.headers.has("Cache-Control")) {
    const directives = [`max-age=${(maxage / 1000) | 0}`];
    if (immutable) {
      directives.push("immutable");
    }
    response.headers.set("Cache-Control", directives.join(","));
  }
  if (!response.type) {
    response.type = encodingExt !== ""
      ? extname(basename(path, encodingExt))
      : extname(path);
  }

  let entity: Uint8Array | FileInfo | null = null;
  let body: Uint8Array | Deno.File | null = null;

  if (request.headers.has("If-None-Match") && mtime) {
    [body, entity] = await getEntity(path, mtime, stats, maxbuffer, response);
    if (!ifNoneMatch(request.headers.get("If-None-Match")!, entity)) {
      response.headers.set("ETag", calculate(entity));
      response.status = 304;
      return path;
    }
  }

  if (request.headers.has("If-Modified-Since") && mtime) {
    const ifModifiedSince = new Date(request.headers.get("If-Modified-Since")!);
    if (ifModifiedSince.getTime() >= mtime) {
      response.status = 304;
      return path;
    }
  }

  if (!body || !entity) {
    [body, entity] = await getEntity(
      path,
      mtime ?? 0,
      stats,
      maxbuffer,
      response,
    );
  }

  if (
    request.headers.has("If-Range") && mtime &&
    ifRange(request.headers.get("If-Range")!, mtime, entity) &&
    request.headers.has("Range")
  ) {
    await sendRange(response, body, request.headers.get("Range")!, stats.size);
    return path;
  }

  if (request.headers.has("Range")) {
    await sendRange(response, body, request.headers.get("Range")!, stats.size);
    return path;
  }

  response.headers.set("Content-Length", String(stats.size));
  response.body = body;

  if (!response.headers.has("ETag")) {
    response.headers.set("ETag", calculate(entity));
  }

  if (!response.headers.has("Accept-Ranges")) {
    response.headers.set("Accept-Ranges", "bytes");
  }

  return path;
}
