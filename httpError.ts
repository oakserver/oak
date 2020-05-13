/*!
 * Adapted directly from http-errors at https://github.com/jshttp/http-errors
 * which is licensed as follows:
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Jonathan Ong me@jongleberry.com
 * Copyright (c) 2016 Douglas Christopher Wilson doug@somethingdoug.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { STATUS_TEXT } from "./deps.ts";
import { ErrorStatus } from "./types.ts";

const errorStatusMap = new Map<string, ErrorStatus>();
errorStatusMap.set("BadRequest", 400);
errorStatusMap.set("Unauthorized", 401);
errorStatusMap.set("PaymentRequired", 402);
errorStatusMap.set("Forbidden", 403);
errorStatusMap.set("NotFound", 404);
errorStatusMap.set("MethodNotAllowed", 405);
errorStatusMap.set("NotAcceptable", 406);
errorStatusMap.set("ProxyAuthRequired", 407);
errorStatusMap.set("RequestTimeout", 408);
errorStatusMap.set("Conflict", 409);
errorStatusMap.set("Gone", 410);
errorStatusMap.set("LengthRequired", 411);
errorStatusMap.set("PreconditionFailed", 412);
errorStatusMap.set("RequestEntityTooLarge", 413);
errorStatusMap.set("RequestURITooLong", 414);
errorStatusMap.set("UnsupportedMediaType", 415);
errorStatusMap.set("RequestedRangeNotSatisfiable", 416);
errorStatusMap.set("ExpectationFailed", 417);
errorStatusMap.set("Teapot", 418);
errorStatusMap.set("MisdirectedRequest", 421);
errorStatusMap.set("UnprocessableEntity", 422);
errorStatusMap.set("Locked", 423);
errorStatusMap.set("FailedDependency", 424);
errorStatusMap.set("UpgradeRequired", 426);
errorStatusMap.set("PreconditionRequired", 428);
errorStatusMap.set("TooManyRequests", 429);
errorStatusMap.set("RequestHeaderFieldsTooLarge", 431);
errorStatusMap.set("UnavailableForLegalReasons", 451);
errorStatusMap.set("InternalServerError", 500);
errorStatusMap.set("NotImplemented", 501);
errorStatusMap.set("BadGateway", 502);
errorStatusMap.set("ServiceUnavailable", 503);
errorStatusMap.set("GatewayTimeout", 504);
errorStatusMap.set("HTTPVersionNotSupported", 505);
errorStatusMap.set("VariantAlsoNegotiates", 506);
errorStatusMap.set("InsufficientStorage", 507);
errorStatusMap.set("LoopDetected", 508);
errorStatusMap.set("NotExtended", 510);
errorStatusMap.set("NetworkAuthenticationRequired", 511);

export class HttpError extends Error {
  expose = false;
  status = ErrorStatus.InternalServerError;
}

function createHttpErrorConstructor<E extends typeof HttpError>(
  status: ErrorStatus,
): E {
  const name = `${ErrorStatus[status]}Error`;
  const Ctor = class extends HttpError {
    constructor(message?: string) {
      super();
      this.message = message || STATUS_TEXT.get(status as any)!;
      this.status = status;
      this.expose = status >= 400 && status < 500 ? true : false;
      Object.defineProperty(this, "name", {
        configurable: true,
        enumerable: false,
        value: name,
        writable: true,
      });
    }
  };
  return Ctor as E;
}

export const httpErrors: {
  [P in keyof typeof ErrorStatus]: typeof HttpError;
} = {} as any;

for (const [key, value] of errorStatusMap) {
  httpErrors[key as any] = createHttpErrorConstructor(value);
}

/** Create a specific class of `HttpError` based on the status, which defaults
 * to _500 Internal Server Error_.
 */
export function createHttpError(
  status: ErrorStatus = 500,
  message?: string,
): HttpError {
  return new httpErrors[ErrorStatus[status] as any](message);
}

export function isHttpError(value: any): value is HttpError {
  return value instanceof HttpError;
}
