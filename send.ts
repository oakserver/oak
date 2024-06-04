/*!
 * Adapted from koa-send at https://github.com/koajs/send and which is licensed
 * with the MIT license.
 */

/**
 * Contains the send function which can be used to send static assets while
 * supporting a range of HTTP capabilities.
 *
 * This is integrated into the oak context via the `.send()` method.
 *
 * @module
 */

import type { Context } from "./context.ts";
import {
  basename,
  type ByteRange,
  calculate,
  contentType,
  createHttpError,
  extname,
  type FileInfo,
  ifNoneMatch,
  parse,
  range,
  readAll,
  responseRange,
  Status,
} from "./deps.ts";
import type { Response } from "./response.ts";
import { isNode } from "./utils/type_guards.ts";
import { decodeComponent } from "./utils/decode_component.ts";
import { resolvePath } from "./utils/resolve_path.ts";

if (isNode()) {
  console.warn("oak send() does not work under Node.js.");
}

const MAXBUFFER_DEFAULT = 1_048_576; // 1MiB;

/** Options which can be specified when using the {@linkcode send}
 * middleware. */
export interface SendOptions {
  /** Try to serve the brotli version of a file automatically when brotli is
   * supported by a client and if the requested file with `.br` extension
   * exists. (defaults to `true`) */
  brotli?: boolean;

  /** A record of extensions and content types that should be used when
   * determining the content of a file being served. By default, the
   * [`media_type`](https://github.com/oakserver/media_types/) database is used
   * to map an extension to the served content-type. The keys of the map are
   * extensions, and values are the content types to use. The content type can
   * be a partial content type, which will be resolved to a full content type
   * header.
   *
   * Any extensions matched will override the default behavior. Key should
   * include the leading dot (e.g. `.ext` instead of just `ext`).
   *
   * ### Example
   *
   * ```ts
   * app.use((ctx) => {
   *   return send(ctx, ctx.request.url.pathname, {
   *     contentTypes: {
   *       ".importmap": "application/importmap+json"
   *     },
   *     root: ".",
   *   })
   * });
   * ```
   */
  contentTypes?: Record<string, string>;

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
): Promise<[Uint8Array | Deno.FsFile, Uint8Array | FileInfo, FileInfo]> {
  let body: Uint8Array | Deno.FsFile;
  let entity: Uint8Array | FileInfo;
  const fileInfo = { mtime: new Date(mtime), size: stats.size };
  const file = await Deno.open(path, { read: true });
  if (stats.size < maxbuffer) {
    const buffer = await readAll(file);
    file.close();
    body = entity = buffer;
  } else {
    response.addResource(file);
    body = file;
    entity = fileInfo;
  }
  return [body, entity, fileInfo];
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
    contentTypes = {},
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
    // TODO(@kitsonk) remove when https://github.com/denoland/node_deno_shims/issues/87 resolved
    if (err instanceof Error && err.message.startsWith("ENOENT:")) {
      throw createHttpError(404, err.message);
    }
    throw createHttpError(
      500,
      err instanceof Error ? err.message : "[non-error thrown]",
    );
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
      : contentTypes[extname(path)] ?? extname(path);
  }

  let entity: Uint8Array | FileInfo | null = null;
  let body: Uint8Array | Deno.FsFile | null = null;
  let fileInfo: FileInfo | null = null;

  if (request.headers.has("If-None-Match") && mtime) {
    [body, entity, fileInfo] = await getEntity(
      path,
      mtime,
      stats,
      maxbuffer,
      response,
    );
    const etag = await calculate(entity);
    if (
      etag && (!ifNoneMatch(request.headers.get("If-None-Match")!, etag))
    ) {
      response.headers.set("ETag", etag);
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

  if (!body || !entity || !fileInfo) {
    [body, entity, fileInfo] = await getEntity(
      path,
      mtime ?? 0,
      stats,
      maxbuffer,
      response,
    );
  }

  let returnRanges: ByteRange[] | undefined = undefined;
  let size: number | undefined = undefined;

  if (request.source && body && entity) {
    const { ok, ranges } = ArrayBuffer.isView(body)
      ? await range(request.source, body, fileInfo)
      : await range(request.source, fileInfo);
    if (ok && ranges) {
      size = ArrayBuffer.isView(entity) ? entity.byteLength : entity.size;
      returnRanges = ranges;
    } else if (!ok) {
      response.status = Status.RequestedRangeNotSatisfiable;
    }
  }

  if (!response.headers.has("ETag")) {
    const etag = await calculate(entity);
    if (etag) {
      response.headers.set("ETag", etag);
    }
  }

  if (returnRanges && size) {
    response.with(
      responseRange(body, size, returnRanges, { headers: response.headers }, {
        type: contentType(response.type),
      }),
    );
  } else {
    response.body = body;
  }

  return path;
}
