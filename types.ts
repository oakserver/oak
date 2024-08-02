// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";

export interface Listener {
  addr: { hostname: string; port: number };
}

export interface OakServer<T> extends AsyncIterable<T> {
  close(): void | Promise<void>;
  listen(): Listener | Promise<Listener>;
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export interface ServerRequest {
  readonly headers: Headers;
  readonly method: string;
  readonly rawUrl?: string;
  readonly remoteAddr: string | undefined;
  readonly request?: Request;
  readonly url: string;
  // deno-lint-ignore no-explicit-any
  error(reason?: any): void;
  getBody(): ReadableStream<Uint8Array> | null;
  respond(response: Response): void | Promise<void>;
  upgrade?(options?: UpgradeWebSocketOptions): WebSocket;
}

/** The abstract constructor interface that custom servers need to adhere to
 * when using with an {@linkcode Application}. */
export interface ServerConstructor<T extends ServerRequest> {
  // deno-lint-ignore no-explicit-any
  new <AS extends State = Record<string, any>>(
    app: Application<AS>,
    options: Omit<ServeOptions | ServeTlsOptions, "signal">,
  ): OakServer<T>;
  prototype: OakServer<T>;
  type?: "native" | "node" | "bun";
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

export interface NetAddr {
  transport: "tcp" | "udp";
  hostname: string;
  port: number;
}

export interface ServeHandlerInfo {
  remoteAddr: Deno.NetAddr;
}

export type ServeHandler = (
  request: Request,
  info: ServeHandlerInfo,
) => Response | Promise<Response>;

export interface ServeOptions {
  port?: number;
  hostname?: string;
  signal?: AbortSignal;
  reusePort?: boolean;
  onError?: (error: unknown) => Response | Promise<Response>;
  onListen?: (params: { hostname: string; port: number }) => void;
}

export interface ServeTlsOptions extends ServeOptions {
  cert: string;
  key: string;
}

export interface ServeInit {
  handler: ServeHandler;
}

export interface HttpServer extends AsyncDisposable {
  finished: Promise<void>;
  ref(): void;
  unref(): void;
  shutdown(): Promise<void>;
}
