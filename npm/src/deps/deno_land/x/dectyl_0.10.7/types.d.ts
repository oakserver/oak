import * as denoShim from "deno.ns";
// Copyright 2021 Deno Land Inc. All rights reserved. MIT license.

export interface RequestEvent {
  readonly request: denoShim.Request;
  respondWith(r: denoShim.Response | Promise<denoShim.Response>): Promise<void>;
}

export type FetchHandler = (evt: RequestEvent) => Promise<void> | void;

export interface DeployOptions extends DeployWorkerOptions {
  /** Determines if the Deploy script should be bundled before being imported
   * into the worker. This defaults to `true`.
   *
   * If not bundling before deploying in the worker, it means the Deno CLI
   * process will import the root module and all of its dependencies, applying
   * the Deno CLI settings. This means by default it will type check any
   * TypeScript modules and has different defaults for JSX/TSX if used in the
   * application.  You may want to use `--no-check` and `--config` to change
   * these behaviors. */
  bundle?: boolean;
  /** A fully qualified path to what should be used for the `cwd` overriding
   * the default `Deno.cwd()`. When local file URLs are relative the value of
   * the `cwd` is used to fully resolve the path. */
  cwd?: string;
  /** The host to use when sending requests into the worker.  Defaults to
   * `localhost`. */
  host?: string;
  /** What the local address will appear as in network connections.  Defaults
   * to `{ hostname: "127.0.0.1", port: 80, transport: "tcp" }` */
  localAddr?: denoShim.Deno.NetAddr;
  /** An optional handler for fetch requests coming from the deploy script.
   * This is design to allow outbound fetch requests from the Deploy script to
   * be intercepted.  If the `respondWith()` is not called in the handler, then
   * the request will simply be passed through to the native `fetch()`.
   *
   * If the value is an array, each handler in the array will be called until
   * one responds, if none of them responds, then the request will be passed
   * to the native `fetch()`. */
  fetchHandler?: FetchHandler | FetchHandler[];
  /** The name of the deploy worker. If `undefined` a unique name will be
   * generated. */
  name?: string;
  /** If the deploy specifier is a local specifier, watch it, and its
   * dependencies for changes and reload the worker when changed. */
  watch?: boolean;
}

export interface DeployWorkerInfo {
  /** The number of fetches that have been made of the worker. */
  fetchCount: number;
  /** The number of pending fetches that are being processed by the worker. */
  pendingFetches: number;
}

export interface DeployWorkerOptions {
  /** Any environment variables to make available to the Deploy script. */
  env?: Record<string, string>;
}

export interface DeployWorkerInit extends DeployWorkerOptions {
  hasFetchHandler: boolean;
  localAddr: denoShim.Deno.NetAddr;
}

export type DectylMessage =
  | AbortMessage
  | BodyChunkMessage
  | BodyCloseMessage
  | BodyErrorMessage
  | FetchMessage
  | ImportMessage
  | InitMessage
  | InternalLogMessage
  | LoadedMessage
  | LogMessage
  | ReadFileMessage
  | ReadFileResponseMessage
  | ReadyMessage
  | RespondErrorMessage
  | RespondMessage;

export interface DectylMessageBase {
  type: string;
}

interface AbortMessage {
  type: "abort";
  id: number;
}

export interface BodyChunkMessage {
  type: "bodyChunk";
  id: number;
  chunk: Uint8Array;
  subType: "request" | "response";
}

export interface BodyCloseMessage {
  type: "bodyClose";
  id: number;
  subType: "request" | "response";
}

export interface BodyErrorMessage {
  type: "bodyError";
  id: number;
  // deno-lint-ignore no-explicit-any
  error: any;
  subType: "request" | "response";
}

export interface FetchMessageBody {
  type: "cloned" | "urlsearchparams" | "stream" | "null";
  value?: denoShim.Blob | BufferSource | [string, string][] | string;
}

export interface FetchMessageRequestInit {
  body: FetchMessageBody;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  headers?: [string, string][];
  integrity?: string;
  keepalive?: boolean;
  method?: string;
  mode?: RequestMode;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  signal?: number;
  url: string;
}

export interface FetchMessage {
  type: "fetch";
  id: number;
  init: FetchMessageRequestInit;
  remoteAddr?: denoShim.Deno.NetAddr;
}

export interface ImportMessage {
  type: "import";
  specifier: string;
}

export interface InitMessage {
  type: "init";
  init: DeployWorkerInit;
}

export interface InternalLogMessage {
  type: "internalLog";
  level: number;
  messages: string[];
}

export interface LoadedMessage {
  type: "loaded";
}

export interface LogMessage {
  type: "log";
  message: string;
  error: boolean;
}

export interface ReadFileMessage {
  type: "readFile";
  id: number;
  path: string;
}

export interface ReadFileResponseMessage {
  type: "readFileResponse";
  id: number;
  error?: {
    message: string;
    name: string;
    stack?: string;
  };
  value?: Uint8Array;
}

export interface ReadyMessage {
  type: "ready";
}

export interface RespondErrorMessage {
  type: "respondError";
  id: number;
  message: string;
  name: string;
  stack?: string;
}

export interface RespondMessage {
  type: "respond";
  id: number;
  hasBody: boolean;
  headers: [string, string][];
  status: number;
  statusText: string;
  url: string;
}
