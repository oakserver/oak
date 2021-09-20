// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { concat, contentType, copyBytes, Status } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import { calculate } from "./etag.ts";
import type { FileInfo } from "./etag.ts";
import { assert, DEFAULT_CHUNK_SIZE } from "./util.ts";

const ETAG_RE = /(?:W\/)?"[ !#-\x7E\x80-\xFF]+"/;

export interface ByteRange {
  start: number;
  end: number;
}

/** Determine, by the value of an `If-Range` header, if a `Range` header should
 * be applied to a request, returning `true` if it should or otherwise
 * `false`. */
export async function ifRange(
  value: string,
  mtime: number,
  entity: Uint8Array | FileInfo,
): Promise<boolean> {
  if (value) {
    const matches = value.match(ETAG_RE);
    if (matches) {
      const [match] = matches;
      if (await calculate(entity) === match) {
        return true;
      }
    } else {
      return new Date(value).getTime() >= mtime;
    }
  }
  return false;
}

export function parseRange(value: string, size: number): ByteRange[] {
  const ranges: ByteRange[] = [];
  const [unit, rangesStr] = value.split("=");
  if (unit !== "bytes") {
    throw createHttpError(Status.RequestedRangeNotSatisfiable);
  }
  for (const range of rangesStr.split(/\s*,\s+/)) {
    const item = range.split("-");
    if (item.length !== 2) {
      throw createHttpError(Status.RequestedRangeNotSatisfiable);
    }
    const [startStr, endStr] = item;
    let start: number;
    let end: number;
    try {
      if (startStr === "") {
        start = size - parseInt(endStr, 10) - 1;
        end = size - 1;
      } else if (endStr === "") {
        start = parseInt(startStr, 10);
        end = size - 1;
      } else {
        start = parseInt(startStr, 10);
        end = parseInt(endStr, 10);
      }
    } catch {
      throw createHttpError();
    }
    if (start < 0 || start >= size || end < 0 || end >= size || start > end) {
      throw createHttpError(Status.RequestedRangeNotSatisfiable);
    }
    ranges.push({ start, end });
  }
  return ranges;
}

/** A reader  */
async function readRange(
  file: Deno.Reader & Deno.Seeker,
  range: ByteRange,
): Promise<Uint8Array> {
  let length = range.end - range.start + 1;
  assert(length);
  await file.seek(range.start, Deno.SeekMode.Start);
  const result = new Uint8Array(length);
  let off = 0;
  while (length) {
    const p = new Uint8Array(Math.min(length, DEFAULT_CHUNK_SIZE));
    const nread = await file.read(p);
    assert(nread !== null, "Unexpected EOF encountered when reading a range.");
    assert(nread > 0, "Unexpected read of 0 bytes while reading a range.");
    copyBytes(p, result, off);
    off += nread;
    length -= nread;
    assert(length >= 0, "Unexpected length remaining.");
  }
  return result;
}

const encoder = new TextEncoder();

/** A class that takes a file (either a Deno.File or Uint8Array) and bytes
 * and streams the ranges as a multi-part encoded HTTP body. */
export class MultiPartStream extends ReadableStream<Uint8Array> {
  #contentLength: number;
  #postscript: Uint8Array;
  #preamble: Uint8Array;

  constructor(
    file: (Deno.Reader & Deno.Seeker & Deno.Closer) | Uint8Array,
    type: string,
    ranges: ByteRange[],
    size: number,
    boundary: string,
  ) {
    super({
      pull: async (controller) => {
        const range = ranges.shift();
        if (!range) {
          controller.enqueue(this.#postscript);
          controller.close();
          if (!(file instanceof Uint8Array)) {
            file.close();
          }
          return;
        }
        let bytes: Uint8Array;
        if (file instanceof Uint8Array) {
          bytes = file.subarray(range.start, range.end + 1);
        } else {
          bytes = await readRange(file, range);
        }
        const rangeHeader = encoder.encode(
          `Content-Range: ${range.start}-${range.end}/${size}\n\n`,
        );
        controller.enqueue(concat(this.#preamble, rangeHeader, bytes));
      },
    });

    const resolvedType = contentType(type);
    if (!resolvedType) {
      throw new TypeError(`Could not resolve media type for "${type}"`);
    }
    this.#preamble = encoder.encode(
      `\n--${boundary}\nContent-Type: ${resolvedType}\n`,
    );

    this.#postscript = encoder.encode(`\n--${boundary}--\n`);
    this.#contentLength = ranges.reduce(
      (prev, { start, end }): number => {
        return prev + this.#preamble.length + String(start).length +
          String(end).length + String(size).length + 20 + (end - start);
      },
      this.#postscript.length,
    );
  }

  /** The content length of the entire streamed body. */
  contentLength() {
    return this.#contentLength;
  }
}
