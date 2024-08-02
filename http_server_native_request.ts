// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import type {
  NetAddr,
  ServerRequest,
  UpgradeWebSocketFn,
  UpgradeWebSocketOptions,
} from "./types.ts";
import { createPromiseWithResolvers } from "./utils/create_promise_with_resolvers.ts";

// deno-lint-ignore no-explicit-any
export const DomResponse: typeof Response = (globalThis as any).Response ??
  class MockResponse {};

const maybeUpgradeWebSocket: UpgradeWebSocketFn | undefined =
  "Deno" in globalThis && "upgradeWebSocket" in globalThis.Deno
    // deno-lint-ignore no-explicit-any
    ? (Deno as any).upgradeWebSocket.bind(Deno)
    : undefined;

export function isNativeRequest(r: ServerRequest): r is NativeRequest {
  return r instanceof NativeRequest;
}

export interface NativeRequestInfo {
  remoteAddr?: NetAddr;
  upgradeWebSocket?: UpgradeWebSocketFn;
}

/** An internal oak abstraction for handling a Deno native request. Most users
 * of oak do not need to worry about this abstraction. */
export class NativeRequest implements ServerRequest {
  #remoteAddr?: NetAddr;
  // deno-lint-ignore no-explicit-any
  #reject: (reason?: any) => void;
  #request: Request;
  #resolve: (value: Response) => void;
  #resolved = false;
  #response: Promise<Response>;
  #upgradeWebSocket?: UpgradeWebSocketFn;

  constructor(
    request: Request,
    info: NativeRequestInfo,
  ) {
    this.#remoteAddr = info.remoteAddr;
    // this allows for the value to be explicitly undefined in the options
    this.#upgradeWebSocket = "upgradeWebSocket" in info
      ? info.upgradeWebSocket
      : maybeUpgradeWebSocket;
    this.#request = request;
    const { resolve, reject, promise } = createPromiseWithResolvers<Response>();
    this.#resolve = resolve;
    this.#reject = reject;
    this.#response = promise;
  }

  get body(): ReadableStream<Uint8Array> | null {
    // when shimming with undici under Node.js, this is a
    // `ControlledAsyncIterable`
    // deno-lint-ignore no-explicit-any
    return this.#request.body as any;
  }

  get headers(): Headers {
    return this.#request.headers;
  }

  get method(): string {
    return this.#request.method;
  }

  get remoteAddr(): string | undefined {
    return this.#remoteAddr?.hostname;
  }

  get request(): Request {
    return this.#request;
  }

  get response(): Promise<Response> {
    return this.#response;
  }

  get url(): string {
    try {
      const url = new URL(this.#request.url);
      return this.#request.url.replace(url.origin, "");
    } catch {
      // we don't care about errors, we just want to fall back
    }
    return this.#request.url;
  }

  get rawUrl(): string {
    return this.#request.url;
  }

  // deno-lint-ignore no-explicit-any
  error(reason?: any): void {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#reject(reason);
    this.#resolved = true;
  }

  getBody(): ReadableStream<Uint8Array> | null {
    return this.#request.body;
  }

  respond(response: Response): void {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#resolved = true;
    this.#resolve(response);
  }

  upgrade(options?: UpgradeWebSocketOptions): WebSocket {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    if (!this.#upgradeWebSocket) {
      throw new TypeError("Upgrading web sockets not supported.");
    }
    const { response, socket } = this.#upgradeWebSocket(
      this.#request,
      options,
    );
    this.#resolve(response);
    this.#resolved = true;
    return socket;
  }
}
