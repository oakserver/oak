// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";

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

export interface RequestEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): Promise<void>;
}

export interface HttpConn extends AsyncIterable<RequestEvent> {
  readonly rid: number;
  nextRequest(): Promise<RequestEvent | null>;
  close(): void;
}
