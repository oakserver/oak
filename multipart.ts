// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { BufReader, ReadLineResult } from "./buf_reader.ts";
import { getFilename } from "./content_disposition.ts";
import { equals, errors, extension, writeAll } from "./deps.ts";
import { readHeaders, toParamRegExp, unquote } from "./headers.ts";
import { getRandomFilename, skipLWSPChar, stripEol } from "./util.ts";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const BOUNDARY_PARAM_REGEX = toParamRegExp("boundary", "i");
const DEFAULT_BUFFER_SIZE = 1_048_576; // 1mb
const DEFAULT_MAX_FILE_SIZE = 10_485_760; // 10mb
const DEFAULT_MAX_SIZE = 0; // all files written to disc
const NAME_PARAM_REGEX = toParamRegExp("name", "i");

/** When reading a body in full via `.read()` from a {@linkcode FormDataReader}
 * this is what is what the value is resolved, providing a split between any
 * fields, and multi-part files that were provided. */
export interface FormDataBody {
  /** A record of form parts where the key was the `name` of the part and the
   * value was the value of the part. This record does not include any files
   * that were part of the form data.
   *
   * *Note*: Duplicate names are not included in this record, if there are
   * duplicates, the last value will be the value that is set here.  If there
   * is a possibility of duplicate values, use the `.stream()` method on
   * {@linkcode FormDataReader} to iterate over the values. */
  fields: Record<string, string>;

  /** An array of any files that were part of the form data. */
  files?: FormDataFile[];
}

/** A representation of a file that has been read from a form data body. Based
 * on the {@linkcode FormDataReadOptions} that were passed when reading will
 * determine if files are written to disk or not and how they are written to
 * disk.  When written to disk, the extension of the file will be determined by
 * the content type, with the `.filename` property containing the full path to
 * the file.
 *
 * The original filename as part of the form data is available in
 * `originalName`, but for security and stability reasons, it is not used to
 * determine the name of the file on disk. If further processing or renaming
 * is required, the implementor should do that processing. */
export interface FormDataFile {
  /** When the file has not been written out to disc, the contents of the file
   * as a {@linkcode Uint8Array}. */
  content?: Uint8Array;

  /** The content type of the form data file. */
  contentType: string;

  /** When the file has been written out to disc, the full path to the file. */
  filename?: string;

  /** The `name` that was assigned to the form data file. */
  name: string;

  /** The `filename` that was provided in the form data file. */
  originalName: string;
}

/** Options which impact how the form data is decoded for a
 * {@linkcode FormDataReader}. All these options have sensible defaults for
 * most applications, but can be modified for different use cases. Many of these
 * options can have an impact on the stability of a server, especially if there
 * is someone attempting a denial of service attack on your server, so be
 * careful when changing the defaults. */
export interface FormDataReadOptions {
  /** The size of the buffer to read from the request body at a single time.
   * This defaults to 1mb. */
  bufferSize?: number;

  /** A mapping of custom media types that are supported, mapped to their
   * extension when determining the extension for a file. The key should be an
   * all lowercase media type with the value being the extension (without an
   * initial period), to be used when decoding the file.
   *
   * ### Example
   *
   * Form data that is sent with content having a type of `text/vdn.custom` will
   * be decoded and assigned a filename ending with `.txt`:
   *
   * ```ts
   * import { Application } from "https://deno.land/x/oak/mod.ts";
   *
   * const app = new Application();
   * app.use(async (ctx) => {
   *   const body = ctx.request.body();
   *   if (body.type === "form-data") {
   *     const formatData = await body.value.read({
   *       customContentTypes: {
   *         "text/vnd.custom": "txt"
   *       }
   *     });
   *     console.log(formData);
   *   }
   * });
   * ```
   */
  customContentTypes?: Record<string, string>;

  /** The maximum file size (in bytes) that can be handled.  This defaults to
   * 10MB when not specified.  This is to try to avoid DOS attacks where
   * someone would continue to try to send a "file" continuously until a host
   * limit was reached crashing the server or the host. Also see `maxSize`. */
  maxFileSize?: number;

  /** The maximum size (in bytes) of a file to hold in memory, and not write
   * to disk. This defaults to `0`, so that all multipart form files are
   * written to disk. When set to a positive integer, if the form data file is
   * smaller, it will be retained in memory and available in the `.content`
   * property of the `FormDataFile` object.  If the file exceeds the `maxSize`
   * it will be written to disk and the `.filename` property will contain the
   * full path to the output file. */
  maxSize?: number;

  /** When writing form data files to disk, the output path.  This will default
   * to a temporary path generated by `Deno.makeTempDir()`. */
  outPath?: string;

  /** When a form data file is written to disk, it will be generated with a
   * random filename and have an extension based off the content type for the
   * file.  `prefix` can be specified though to prepend to the file name. */
  prefix?: string;
}

interface PartsOptions {
  body: BufReader;
  customContentTypes?: Record<string, string>;
  final: Uint8Array;
  maxFileSize: number;
  maxSize: number;
  outPath?: string;
  part: Uint8Array;
  prefix?: string;
}

function append(a: Uint8Array, b: Uint8Array): Uint8Array {
  const ab = new Uint8Array(a.length + b.length);
  ab.set(a, 0);
  ab.set(b, a.length);
  return ab;
}

function isEqual(a: Uint8Array, b: Uint8Array): boolean {
  return equals(skipLWSPChar(a), b);
}

async function readToStartOrEnd(
  body: BufReader,
  start: Uint8Array,
  end: Uint8Array,
): Promise<boolean> {
  let lineResult: ReadLineResult | null;
  while ((lineResult = await body.readLine())) {
    if (isEqual(lineResult.bytes, start)) {
      return true;
    }
    if (isEqual(lineResult.bytes, end)) {
      return false;
    }
  }
  throw new errors.BadRequest(
    "Unable to find multi-part boundary.",
  );
}

/** Yield up individual parts by reading the body and parsing out the ford
 * data values. */
async function* parts(
  {
    body,
    customContentTypes = {},
    final,
    part,
    maxFileSize,
    maxSize,
    outPath,
    prefix,
  }: PartsOptions,
): AsyncIterableIterator<[string, string | FormDataFile]> {
  async function getFile(contentType: string): Promise<[string, Deno.FsFile]> {
    const ext = customContentTypes[contentType.toLowerCase()] ??
      extension(contentType);
    if (!ext) {
      throw new errors.BadRequest(
        `The form contained content type "${contentType}" which is not supported by the server.`,
      );
    }
    if (!outPath) {
      outPath = await Deno.makeTempDir();
    }
    const filename = `${outPath}/${await getRandomFilename(prefix, ext)}`;
    const file = await Deno.open(filename, { write: true, createNew: true });
    return [filename, file];
  }

  while (true) {
    const headers = await readHeaders(body);
    const contentType = headers["content-type"];
    const contentDisposition = headers["content-disposition"];
    if (!contentDisposition) {
      throw new errors.BadRequest(
        "Form data part missing content-disposition header",
      );
    }
    if (!contentDisposition.match(/^form-data;/i)) {
      throw new errors.BadRequest(
        `Unexpected content-disposition header: "${contentDisposition}"`,
      );
    }
    const matches = NAME_PARAM_REGEX.exec(contentDisposition);
    if (!matches) {
      throw new errors.BadRequest(
        `Unable to determine name of form body part`,
      );
    }
    let [, name] = matches;
    name = unquote(name);
    if (contentType) {
      const originalName = getFilename(contentDisposition);
      let byteLength = 0;
      let file: Deno.FsFile | undefined;
      let filename: string | undefined;
      let buf: Uint8Array | undefined;
      if (maxSize) {
        buf = new Uint8Array();
      } else {
        const result = await getFile(contentType);
        filename = result[0];
        file = result[1];
      }
      while (true) {
        const readResult = await body.readLine(false);
        if (!readResult) {
          throw new errors.BadRequest("Unexpected EOF reached");
        }
        const { bytes } = readResult;
        const strippedBytes = stripEol(bytes);
        if (isEqual(strippedBytes, part) || isEqual(strippedBytes, final)) {
          if (file) {
            // remove extra 2 bytes ([CR, LF]) from result file
            const bytesDiff = bytes.length - strippedBytes.length;
            if (bytesDiff) {
              const originalBytesSize = await file.seek(
                -bytesDiff,
                Deno.SeekMode.Current,
              );
              await file.truncate(originalBytesSize);
            }

            file.close();
          }
          yield [
            name,
            {
              content: buf,
              contentType,
              name,
              filename,
              originalName,
            } as FormDataFile,
          ];
          if (isEqual(strippedBytes, final)) {
            return;
          }
          break;
        }
        byteLength += bytes.byteLength;
        if (byteLength > maxFileSize) {
          if (file) {
            file.close();
          }
          throw new errors.RequestEntityTooLarge(
            `File size exceeds limit of ${maxFileSize} bytes.`,
          );
        }
        if (buf) {
          if (byteLength > maxSize) {
            const result = await getFile(contentType);
            filename = result[0];
            file = result[1];
            await writeAll(file, buf);
            buf = undefined;
          } else {
            buf = append(buf, bytes);
          }
        }
        if (file) {
          await writeAll(file, bytes);
        }
      }
    } else {
      const lines: string[] = [];
      while (true) {
        const readResult = await body.readLine();
        if (!readResult) {
          throw new errors.BadRequest("Unexpected EOF reached");
        }
        const { bytes } = readResult;
        if (isEqual(bytes, part) || isEqual(bytes, final)) {
          yield [name, lines.join("\n")];
          if (isEqual(bytes, final)) {
            return;
          }
          break;
        }
        lines.push(decoder.decode(bytes));
      }
    }
  }
}

/** An interface which provides an interface to access the fields of a
 * `multipart/form-data` body.
 *
 * Normally an instance of this is accessed when handling a request body, and
 * dealing with decoding it.  There are options that can be set when attempting
 * to read a multi-part body (see: {@linkcode FormDataReadOptions}).
 *
 * If you `.read()` the value, then a promise is provided of type
 * {@linkcode FormDataBody}. If you use the `.stream()` property, it is an async
 * iterator which yields up a tuple of with the first element being a
 *
 * ### Examples
 *
 * Using `.read()`:
 *
 * ```ts
 * import { Application } from "https://deno.land/x/oak/mod.ts";
 *
 * const app = new Application();
 *
 * app.use(async (ctx) => {
 *   const body = ctx.request.body();
 *   if (body.type === "form-data") {
 *     const value = body.value;
 *     const formData = await value.read();
 *     // the form data is fully available
 *   }
 * });
 * ```
 *
 *  Using `.stream()`:
 *
 * ```ts
 * import { Application } from "https://deno.land/x/oak/mod.ts";
 *
 * const app = new Application();
 *
 * app.use(async (ctx) => {
 *   const body = ctx.request.body();
 *   if (body.type === "form-data") {
 *     const value = body.value;
 *     for await (const [name, value] of value.stream()) {
 *       // asynchronously iterate each part of the body
 *     }
 *   }
 * });
 * ```
 */
export class FormDataReader {
  #body: Deno.Reader;
  #boundaryFinal: Uint8Array;
  #boundaryPart: Uint8Array;
  #reading = false;

  constructor(contentType: string, body: Deno.Reader) {
    const matches = contentType.match(BOUNDARY_PARAM_REGEX);
    if (!matches) {
      throw new errors.BadRequest(
        `Content type "${contentType}" does not contain a valid boundary.`,
      );
    }
    let [, boundary] = matches;
    boundary = unquote(boundary);
    this.#boundaryPart = encoder.encode(`--${boundary}`);
    this.#boundaryFinal = encoder.encode(`--${boundary}--`);
    this.#body = body;
  }

  /** Reads the multipart body of the response and resolves with an object which
   * contains fields and files that were part of the response.
   *
   * *Note*: this method handles multiple files with the same `name` attribute
   * in the request, but by design it does not handle multiple fields that share
   * the same `name`.  If you expect the request body to contain multiple form
   * data fields with the same name, it is better to use the `.stream()` method
   * which will iterate over each form data field individually. */
  async read(options: FormDataReadOptions = {}): Promise<FormDataBody> {
    if (this.#reading) {
      throw new Error("Body is already being read.");
    }
    this.#reading = true;
    const {
      outPath,
      maxFileSize = DEFAULT_MAX_FILE_SIZE,
      maxSize = DEFAULT_MAX_SIZE,
      bufferSize = DEFAULT_BUFFER_SIZE,
      customContentTypes,
    } = options;
    const body = new BufReader(this.#body, bufferSize);
    const result: FormDataBody = { fields: {} };
    if (
      !(await readToStartOrEnd(body, this.#boundaryPart, this.#boundaryFinal))
    ) {
      return result;
    }
    try {
      for await (
        const part of parts({
          body,
          customContentTypes,
          part: this.#boundaryPart,
          final: this.#boundaryFinal,
          maxFileSize,
          maxSize,
          outPath,
        })
      ) {
        const [key, value] = part;
        if (typeof value === "string") {
          result.fields[key] = value;
        } else {
          if (!result.files) {
            result.files = [];
          }
          result.files.push(value);
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.PermissionDenied) {
        console.error(err.stack ? err.stack : `${err.name}: ${err.message}`);
      } else {
        throw err;
      }
    }
    return result;
  }

  /** Returns an iterator which will asynchronously yield each part of the form
   * data.  The yielded value is a tuple, where the first element is the name
   * of the part and the second element is a `string` or a `FormDataFile`
   * object. */
  async *stream(
    options: FormDataReadOptions = {},
  ): AsyncIterableIterator<[name: string, value: string | FormDataFile]> {
    if (this.#reading) {
      throw new Error("Body is already being read.");
    }
    this.#reading = true;
    const {
      outPath,
      customContentTypes,
      maxFileSize = DEFAULT_MAX_FILE_SIZE,
      maxSize = DEFAULT_MAX_SIZE,
      bufferSize = 32000,
    } = options;
    const body = new BufReader(this.#body, bufferSize);
    if (
      !(await readToStartOrEnd(body, this.#boundaryPart, this.#boundaryFinal))
    ) {
      return;
    }
    try {
      for await (
        const part of parts({
          body,
          customContentTypes,
          part: this.#boundaryPart,
          final: this.#boundaryFinal,
          maxFileSize,
          maxSize,
          outPath,
        })
      ) {
        yield part;
      }
    } catch (err) {
      if (err instanceof Deno.errors.PermissionDenied) {
        console.error(err.stack ? err.stack : `${err.name}: ${err.message}`);
      } else {
        throw err;
      }
    }
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    return `${this.constructor.name} ${inspect({})}`;
  }

  [Symbol.for("nodejs.util.inspect.custom")](
    depth: number,
    // deno-lint-ignore no-explicit-any
    options: any,
    inspect: (value: unknown, options?: unknown) => string,
  ) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }

    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1,
    });
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect({}, newOptions)
    }`;
  }
}
