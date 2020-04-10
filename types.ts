// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

export enum ErrorStatus {
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
  NetworkAuthenticationRequired = 511, // RFC 6585, 6
}

export type HTTPMethods =
  | "HEAD"
  | "OPTIONS"
  | "GET"
  | "PUT"
  | "PATCH"
  | "POST"
  | "DELETE";
