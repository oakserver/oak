/*!
 * Adapted from koa-send at https://github.com/koajs/send and which is licensed
 * with the MIT license.
 */

import { Context } from "./context.ts";
import { createHttpError } from "./httpError.ts";
import { basename, extname, parse, sep } from "./deps.ts";
import { decodeComponent, resolvePath } from "./util.ts";

export interface SendOptions {
  /** Browser cache max-age in milliseconds. (defaults to `0`) */
  maxage?: number;

  /** Tell the browser the resource is immutable and can be cached
   * indefinitely. (defaults to `false`) */
  immutable?: boolean;

  /** Allow transfer of hidden files. (defaults to `false`) */
  hidden?: boolean;

  /** Root directory to restrict file access. */
  root: string;

  /** Name of the index file to serve automatically when visiting the root
   * location. (defaults to none) */
  index?: string;

  /** Try to serve the gzipped version of a file automatically when gzip is
   * supported by a client and if the requested file with `.gz` extension
   * exists. (defaults to `true`). */
  gzip?: boolean;

  /** Try to serve the brotli version of a file automatically when brotli is
   * supported by a client and if the requested file with `.br` extension
   * exists. (defaults to `true`) */
  brotli?: boolean;

  /** If `true`, format the path to serve static file servers and not require a
   * trailing slash for directories, so that you can do both `/directory` and
   * `/directory/`. (defaults to `true`) */
  format?: boolean;

  /** Try to match extensions from passed array to search for file when no
   * extension is sufficed in URL. First found is served. (defaults to
   * `undefined`) */
  extensions?: string[];
}

function isHidden(root: string, path: string) {
  const pathArr = path.substr(root.length).split(sep);
  for (const segment of pathArr) {
    if (segment[0] === ".") {
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

function toUTCString(value: number): string {
  return new Date(value).toUTCString();
}

/** Asynchronously fulfill a response with a file from the local file
 * system. */
export async function send(
  { request, response }: Context,
  path: string,
  options: SendOptions = { root: "" },
): Promise<string | undefined> {
  const {
    brotli = true,
    extensions,
    format = true,
    gzip = true,
    index,
    hidden = false,
    immutable = false,
    maxage = 0,
    root,
  } = options;
  const trailingSlash = path[path.length - 1] === "/";
  path = decodeComponent(path.substr(parse(path).root.length));
  if (index && trailingSlash) {
    path += index;
  }

  path = resolvePath(root, path);

  if (!hidden && isHidden(root, path)) {
    return;
  }

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

  response.headers.set("Content-Length", String(stats.size));
  if (!response.headers.has("Last-Modified") && stats.modified) {
    response.headers.set("Last-Modified", toUTCString(stats.modified));
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
  response.body = await Deno.readFile(path);

  return path;
}
