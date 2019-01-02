import { STATUS_TEXT } from "./deps.ts";

enum ErrorStatus {
  BadRequest = 400, // RFC 7231, 6.5.1
  Unauthorized = 401, // RFC 7235, 3.1
  PaymentRequired = 402, // RFC 7231, 6.5.2
  Forbidden = 403, // RFC 7231, 6.5.3
  NotFound = 404, // RFC 7231, 6.5.4
  MethodNotAllowed = 405, // RFC 7231, 6.5.5
  NotAcceptable = 406, // RFC 7231, 6.5.6
  ProxyAuthRequired = 407, // RFC 7235, 3.2
  RequestTimeout = 408, // RFC 7231, 6.5.7
  Conflict = 409, // RFC 7231, 6.5.8
  Gone = 410, // RFC 7231, 6.5.9
  LengthRequired = 411, // RFC 7231, 6.5.10
  PreconditionFailed = 412, // RFC 7232, 4.2
  RequestEntityTooLarge = 413, // RFC 7231, 6.5.11
  RequestURITooLong = 414, // RFC 7231, 6.5.12
  UnsupportedMediaType = 415, // RFC 7231, 6.5.13
  RequestedRangeNotSatisfiable = 416, // RFC 7233, 4.4
  ExpectationFailed = 417, // RFC 7231, 6.5.14
  Teapot = 418, // RFC 7168, 2.3.3
  MisdirectedRequest = 421, // RFC 7540, 9.1.2
  UnprocessableEntity = 422, // RFC 4918, 11.2
  Locked = 423, // RFC 4918, 11.3
  FailedDependency = 424, // RFC 4918, 11.4
  UpgradeRequired = 426, // RFC 7231, 6.5.15
  PreconditionRequired = 428, // RFC 6585, 3
  TooManyRequests = 429, // RFC 6585, 4
  RequestHeaderFieldsTooLarge = 431, // RFC 6585, 5
  UnavailableForLegalReasons = 451, // RFC 7725, 3

  InternalServerError = 500, // RFC 7231, 6.6.1
  NotImplemented = 501, // RFC 7231, 6.6.2
  BadGateway = 502, // RFC 7231, 6.6.3
  ServiceUnavailable = 503, // RFC 7231, 6.6.4
  GatewayTimeout = 504, // RFC 7231, 6.6.5
  HTTPVersionNotSupported = 505, // RFC 7231, 6.6.6
  VariantAlsoNegotiates = 506, // RFC 2295, 8.1
  InsufficientStorage = 507, // RFC 4918, 11.5
  LoopDetected = 508, // RFC 5842, 7.2
  NotExtended = 510, // RFC 2774, 7
  NetworkAuthenticationRequired = 511 // RFC 6585, 6
}

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

class HttpError extends Error {
  status: ErrorStatus = 500;
}

function createHttpErrorConstructor<E extends typeof HttpError>(
  status: ErrorStatus
): E {
  const name = `${ErrorStatus[status]}Error`;
  const Ctor = class extends HttpError {
    status = status;
    constructor(message?: string) {
      super();
      this.message = message || STATUS_TEXT.get(status as any)!;
      Object.defineProperty(this, "name", {
        configurable: true,
        enumerable: false,
        value: name,
        writable: true
      });
    }
  };
  return Ctor as E;
}

const httpErrors: { [key: string]: typeof HttpError } = {};

for (const [key, value] of errorStatusMap) {
  httpErrors[key] = createHttpErrorConstructor(value);
}

function createHttpError(
  status: ErrorStatus = 500,
  message?: string
): HttpError {
  return new httpErrors[ErrorStatus[status]](message);
}

const exp: { [P in keyof typeof ErrorStatus]: typeof HttpError } & {
  createHttpError: typeof createHttpError;
  ErrorStatus: typeof ErrorStatus;
} = {
  ...httpErrors,
  createHttpError,
  ErrorStatus
} as any;

export = exp;
