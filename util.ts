// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { isAbsolute, join, normalize, resolve, sep, Status } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import { ErrorStatus, RedirectStatus } from "./types.d.ts";

const ENCODE_CHARS_REGEXP =
  /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;

const UNMATCHED_SURROGATE_PAIR_REGEXP =
  /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;

const UNMATCHED_SURROGATE_PAIR_REPLACE = "$1\uFFFD$2";

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
  if (arguments.length === 1) {
    path = rootPath;
    root = Deno.cwd();
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
  return normalize(join(resolve(root), path));
}
