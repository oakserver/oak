// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { BufReader, BufWriter, Status } from "./deps.ts";

/** A HTTP status that is an error (4XX and 5XX). */
export type ErrorStatus =
  | Status.BadRequest
  | Status.Unauthorized
  | Status.PaymentRequired
  | Status.Forbidden
  | Status.NotFound
  | Status.MethodNotAllowed
  | Status.NotAcceptable
  | Status.ProxyAuthRequired
  | Status.RequestTimeout
  | Status.Conflict
  | Status.Gone
  | Status.LengthRequired
  | Status.PreconditionFailed
  | Status.RequestEntityTooLarge
  | Status.RequestURITooLong
  | Status.UnsupportedMediaType
  | Status.RequestedRangeNotSatisfiable
  | Status.ExpectationFailed
  | Status.Teapot
  | Status.MisdirectedRequest
  | Status.UnprocessableEntity
  | Status.Locked
  | Status.FailedDependency
  | Status.UpgradeRequired
  | Status.PreconditionRequired
  | Status.TooManyRequests
  | Status.RequestHeaderFieldsTooLarge
  | Status.UnavailableForLegalReasons
  | Status.InternalServerError
  | Status.NotImplemented
  | Status.BadGateway
  | Status.ServiceUnavailable
  | Status.GatewayTimeout
  | Status.HTTPVersionNotSupported
  | Status.VariantAlsoNegotiates
  | Status.InsufficientStorage
  | Status.LoopDetected
  | Status.NotExtended
  | Status.NetworkAuthenticationRequired;

/** A HTTP status that is a redirect (3XX). */
export type RedirectStatus =
  | Status.MultipleChoices // 300
  | Status.MovedPermanently // 301
  | Status.Found // 302
  | Status.SeeOther // 303
  | Status.UseProxy // 305 - DEPRECATED
  | Status.TemporaryRedirect // 307
  | Status.PermanentRedirect; // 308

export type HTTPMethods =
  | "HEAD"
  | "OPTIONS"
  | "GET"
  | "PUT"
  | "PATCH"
  | "POST"
  | "DELETE";

type HTTPOptions = Omit<Deno.ListenOptions, "transport">;
type HTTPSOptions = Omit<Deno.ListenTlsOptions, "transport">;
export type Serve = (options: string | HTTPOptions) => Server;
export type ServeTls = (options: HTTPSOptions) => Server;

export interface Server extends AsyncIterable<ServerRequest> {
  close(): void;
}

/** An interface that aligns to the parts of `std/http/server`'s
 * `ServerRequest` that actually is consumed by oak. */
export interface ServerRequest {
  body: Deno.Reader;
  conn: Deno.Conn;
  headers: Headers;
  method: string;
  r: BufReader;
  respond(response: ServerResponse): Promise<void>;
  url: string;
  w: BufWriter;
}

/** An interface that aligns to what oak returns and is compatible with
 * `std/http/server`'s `request.respond()`. */
export interface ServerResponse {
  status: number;
  headers: Headers;
  body: Uint8Array | Deno.Reader | undefined;
}
