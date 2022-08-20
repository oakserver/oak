// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";
import type { Status } from "./deps.ts";

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

export interface Listener {
  addr: { hostname: string; port: number };
}

export interface Server<T> extends AsyncIterable<T> {
  close(): void | Promise<void>;
  listen(): Listener | Promise<Listener>;
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export interface ServerRequestBody {
  body: ReadableStream<Uint8Array> | null;
  readBody: () => Promise<Uint8Array>;
}

export interface ServerRequest {
  readonly remoteAddr: string | undefined;
  readonly headers: Headers;
  readonly method: string;
  readonly rawUrl?: string;
  readonly url: string;
  // deno-lint-ignore no-explicit-any
  error(reason?: any): void;
  getBody(): ServerRequestBody;
  respond(response: Response): Promise<void>;
  upgrade?(options?: UpgradeWebSocketOptions): WebSocket;
}

export interface ServerConstructor<T extends ServerRequest> {
  // deno-lint-ignore no-explicit-any
  new <AS extends State = Record<string, any>>(
    app: Application<AS>,
    options: Deno.ListenOptions | Deno.ListenTlsOptions,
  ): Server<T>;
  prototype: Server<T>;
}

export type Data = string | number[] | ArrayBuffer | Uint8Array;
export type Key = string | number[] | ArrayBuffer | Uint8Array;

export interface UpgradeWebSocketOptions {
  protocol?: string;
}

export type UpgradeWebSocketFn = (
  request: Request,
  options?: UpgradeWebSocketOptions,
) => WebSocketUpgrade;

interface WebSocketUpgrade {
  response: Response;
  socket: WebSocket;
}

// Since the native bindings are currently unstable in Deno, we will add the
// interfaces here, so that we can type check oak without requiring the
// `--unstable` flag to be used.

export interface RequestEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): Promise<void>;
}

export interface HttpConn extends AsyncIterable<RequestEvent> {
  readonly rid: number;
  nextRequest(): Promise<RequestEvent | null>;
  close(): void;
}
