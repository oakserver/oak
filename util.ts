// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type { State } from "./application.ts";
import type { Context } from "./context.ts";
import { base64, isAbsolute, join, normalize, sep, Status } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import type { RouteParams, RouterContext } from "./router.ts";
import type { Data, ErrorStatus, Key, RedirectStatus } from "./types.d.ts";

const ENCODE_CHARS_REGEXP =
  /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;
const HTAB = "\t".charCodeAt(0);
const SPACE = " ".charCodeAt(0);
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
const UNMATCHED_SURROGATE_PAIR_REGEXP =
  /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;
const UNMATCHED_SURROGATE_PAIR_REPLACE = "$1\uFFFD$2";
export const DEFAULT_CHUNK_SIZE = 16_640; // 17 Kib

/** Body types which will be coerced into strings before being sent. */
export const BODY_TYPES = ["string", "number", "bigint", "boolean", "symbol"];

export function assert(cond: unknown, msg = "Assertion failed"): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

/** Safely decode a URI component, where if it fails, instead of throwing,
 * just returns the original string
 */
export function decodeComponent(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Encodes the url preventing double enconding */
export function encodeUrl(url: string) {
  return String(url)
    .replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE)
    .replace(ENCODE_CHARS_REGEXP, encodeURI);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const arr = Array.from(new Uint8Array(buffer));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getRandomFilename(
  prefix = "",
  extension = "",
): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-1",
    crypto.getRandomValues(new Uint8Array(256)),
  );
  return `${prefix}${bufferToHex(buffer)}${extension ? `.${extension}` : ""}`;
}

export async function getBoundary(): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-1",
    crypto.getRandomValues(new Uint8Array(256)),
  );
  return `oak_${bufferToHex(buffer)}`;
}

/** Guard for Async Iterables */
export function isAsyncIterable(
  value: unknown,
): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null &&
    Symbol.asyncIterator in value &&
    // deno-lint-ignore no-explicit-any
    typeof (value as any)[Symbol.asyncIterator] === "function";
}

export function isRouterContext<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(
  value: Context<S>,
): value is RouterContext<R, P, S> {
  return "params" in value;
}

/** Guard for `Deno.Reader`. */
export function isReader(value: unknown): value is Deno.Reader {
  return typeof value === "object" && value !== null && "read" in value &&
    typeof (value as Record<string, unknown>).read === "function";
}

function isCloser(value: unknown): value is Deno.Closer {
  return typeof value === "object" && value != null && "close" in value &&
    // deno-lint-ignore no-explicit-any
    typeof (value as Record<string, any>)["close"] === "function";
}

export function isConn(value: unknown): value is Deno.Conn {
  return typeof value === "object" && value != null && "rid" in value &&
    // deno-lint-ignore no-explicit-any
    typeof (value as any).rid === "number" && "localAddr" in value &&
    "remoteAddr" in value;
}

export function isListenTlsOptions(
  value: unknown,
): value is Deno.ListenTlsOptions {
  return typeof value === "object" && value !== null && "certFile" in value &&
    "keyFile" in value && "port" in value;
}

export interface ReadableStreamFromReaderOptions {
  /** If the `reader` is also a `Deno.Closer`, automatically close the `reader`
   * when `EOF` is encountered, or a read error occurs.
   *
   * Defaults to `true`. */
  autoClose?: boolean;

  /** The size of chunks to allocate to read, the default is ~16KiB, which is
   * the maximum size that Deno operations can currently support. */
  chunkSize?: number;

  /** The queuing strategy to create the `ReadableStream` with. */
  strategy?: { highWaterMark?: number | undefined; size?: undefined };
}

/**
 * Create a `ReadableStream<Uint8Array>` from an `AsyncIterable`.
 */
export function readableStreamFromAsyncIterable(
  source: AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of source) {
        if (BODY_TYPES.includes(typeof chunk)) {
          controller.enqueue(encoder.encode(String(chunk)));
        } else if (chunk instanceof Uint8Array) {
          controller.enqueue(chunk);
        } else if (ArrayBuffer.isView(chunk)) {
          controller.enqueue(new Uint8Array(chunk.buffer));
        } else if (chunk instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(chunk));
        } else {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(chunk)));
          } catch {
            // we just swallow errors here
          }
        }
      }
      controller.close();
    },
  });
}

/**
 * Create a `ReadableStream<Uint8Array>` from a `Deno.Reader`.
 *
 * When the pull algorithm is called on the stream, a chunk from the reader
 * will be read.  When `null` is returned from the reader, the stream will be
 * closed along with the reader (if it is also a `Deno.Closer`).
 *
 * An example converting a `Deno.File` into a readable stream:
 *
 * ```ts
 * import { readableStreamFromReader } from "https://deno.land/std/io/mod.ts";
 *
 * const file = await Deno.open("./file.txt", { read: true });
 * const fileStream = readableStreamFromReader(file);
 * ```
 */
export function readableStreamFromReader(
  reader: Deno.Reader | (Deno.Reader & Deno.Closer),
  options: ReadableStreamFromReaderOptions = {},
): ReadableStream<Uint8Array> {
  const {
    autoClose = true,
    chunkSize = DEFAULT_CHUNK_SIZE,
    strategy,
  } = options;

  return new ReadableStream({
    async pull(controller) {
      const chunk = new Uint8Array(chunkSize);
      try {
        const read = await reader.read(chunk);
        if (read === null) {
          if (isCloser(reader) && autoClose) {
            reader.close();
          }
          controller.close();
          return;
        }
        controller.enqueue(chunk.subarray(0, read));
      } catch (e) {
        controller.error(e);
        if (isCloser(reader)) {
          reader.close();
        }
      }
    },
    cancel() {
      if (isCloser(reader) && autoClose) {
        reader.close();
      }
    },
  }, strategy);
}

/** Determines if a HTTP `Status` is an `ErrorStatus` (4XX or 5XX). */
export function isErrorStatus(value: Status): value is ErrorStatus {
  return [
    Status.BadRequest,
    Status.Unauthorized,
    Status.PaymentRequired,
    Status.Forbidden,
    Status.NotFound,
    Status.MethodNotAllowed,
    Status.NotAcceptable,
    Status.ProxyAuthRequired,
    Status.RequestTimeout,
    Status.Conflict,
    Status.Gone,
    Status.LengthRequired,
    Status.PreconditionFailed,
    Status.RequestEntityTooLarge,
    Status.RequestURITooLong,
    Status.UnsupportedMediaType,
    Status.RequestedRangeNotSatisfiable,
    Status.ExpectationFailed,
    Status.Teapot,
    Status.MisdirectedRequest,
    Status.UnprocessableEntity,
    Status.Locked,
    Status.FailedDependency,
    Status.UpgradeRequired,
    Status.PreconditionRequired,
    Status.TooManyRequests,
    Status.RequestHeaderFieldsTooLarge,
    Status.UnavailableForLegalReasons,
    Status.InternalServerError,
    Status.NotImplemented,
    Status.BadGateway,
    Status.ServiceUnavailable,
    Status.GatewayTimeout,
    Status.HTTPVersionNotSupported,
    Status.VariantAlsoNegotiates,
    Status.InsufficientStorage,
    Status.LoopDetected,
    Status.NotExtended,
    Status.NetworkAuthenticationRequired,
  ].includes(value);
}

/** Determines if a HTTP `Status` is a `RedirectStatus` (3XX). */
export function isRedirectStatus(value: Status): value is RedirectStatus {
  return [
    Status.MultipleChoices,
    Status.MovedPermanently,
    Status.Found,
    Status.SeeOther,
    Status.UseProxy,
    Status.TemporaryRedirect,
    Status.PermanentRedirect,
  ].includes(value);
}

/** Determines if a string "looks" like HTML */
export function isHtml(value: string): boolean {
  return /^\s*<(?:!DOCTYPE|html|body)/i.test(value);
}

/** Returns `u8` with leading white space removed. */
export function skipLWSPChar(u8: Uint8Array): Uint8Array {
  const result = new Uint8Array(u8.length);
  let j = 0;
  for (let i = 0; i < u8.length; i++) {
    if (u8[i] === SPACE || u8[i] === HTAB) continue;
    result[j++] = u8[i];
  }
  return result.slice(0, j);
}

export function stripEol(value: Uint8Array): Uint8Array {
  if (value[value.byteLength - 1] == LF) {
    let drop = 1;
    if (value.byteLength > 1 && value[value.byteLength - 2] === CR) {
      drop = 2;
    }
    return value.subarray(0, value.byteLength - drop);
  }
  return value;
}

/*!
 * Adapted directly from https://github.com/pillarjs/resolve-path
 * which is licensed as follows:
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Jonathan Ong <me@jongleberry.com>
 * Copyright (c) 2015-2018 Douglas Christopher Wilson <doug@somethingdoug.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * 'Software'), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

export function resolvePath(relativePath: string): string;
export function resolvePath(rootPath: string, relativePath: string): string;
export function resolvePath(rootPath: string, relativePath?: string): string {
  let path = relativePath;
  let root = rootPath;

  // root is optional, similar to root.resolve
  if (relativePath === undefined) {
    path = rootPath;
    root = ".";
  }

  if (path == null) {
    throw new TypeError("Argument relativePath is required.");
  }

  // containing NULL bytes is malicious
  if (path.includes("\0")) {
    throw createHttpError(400, "Malicious Path");
  }

  // path should never be absolute
  if (isAbsolute(path)) {
    throw createHttpError(400, "Malicious Path");
  }

  // path outside root
  if (UP_PATH_REGEXP.test(normalize("." + sep + path))) {
    throw createHttpError(403);
  }

  // join the relative path
  return normalize(join(root, path));
}

/** A utility class that transforms "any" chunk into an `Uint8Array`. */
export class Uint8ArrayTransformStream
  extends TransformStream<unknown, Uint8Array> {
  constructor() {
    const init = {
      async transform(
        chunk: unknown,
        controller: TransformStreamDefaultController<Uint8Array>,
      ) {
        chunk = await chunk;
        switch (typeof chunk) {
          case "object":
            if (chunk === null) {
              controller.terminate();
            } else if (ArrayBuffer.isView(chunk)) {
              controller.enqueue(
                new Uint8Array(
                  chunk.buffer,
                  chunk.byteOffset,
                  chunk.byteLength,
                ),
              );
            } else if (
              Array.isArray(chunk) &&
              chunk.every((value) => typeof value === "number")
            ) {
              controller.enqueue(new Uint8Array(chunk));
            } else if (
              typeof chunk.valueOf === "function" && chunk.valueOf() !== chunk
            ) {
              this.transform(chunk.valueOf(), controller);
            } else if ("toJSON" in chunk) {
              this.transform(JSON.stringify(chunk), controller);
            }
            break;
          case "symbol":
            controller.error(
              new TypeError("Cannot transform a symbol to a Uint8Array"),
            );
            break;
          case "undefined":
            controller.error(
              new TypeError("Cannot transform undefined to a Uint8Array"),
            );
            break;
          default:
            controller.enqueue(this.encoder.encode(String(chunk)));
        }
      },
      encoder: new TextEncoder(),
    };
    super(init);
  }
}

const replacements: Record<string, string> = {
  "/": "_",
  "+": "-",
  "=": "",
};

const encoder = new TextEncoder();

export function encodeBase64Safe(data: string | ArrayBuffer): string {
  return base64.encode(data).replace(/\/|\+|=/g, (c) => replacements[c]);
}

export function importKey(key: Key): Promise<CryptoKey> {
  if (typeof key === "string") {
    key = encoder.encode(key);
  } else if (Array.isArray(key) || key instanceof ArrayBuffer) {
    // TODO(@kitsonk) don't transform AB when https://github.com/denoland/deno/issues/11664 is fixed
    key = new Uint8Array(key);
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    key,
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    true,
    ["sign", "verify"],
  );
}

export function sign(data: Data, key: CryptoKey): Promise<ArrayBuffer> {
  if (typeof data === "string") {
    data = encoder.encode(data);
  } else if (Array.isArray(data)) {
    data = Uint8Array.from(data);
  }
  return crypto.subtle.sign("HMAC", key, data);
}
