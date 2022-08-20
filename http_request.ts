// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { type Deferred } from "./deps.ts";
import type {
  ServerRequest,
  ServerRequestBody,
  UpgradeWebSocketFn,
  UpgradeWebSocketOptions,
} from "./types.d.ts";

const maybeUpgradeWebSocket: UpgradeWebSocketFn | undefined =
  "upgradeWebSocket" in Deno
    ? // deno-lint-ignore no-explicit-any
      (Deno as any).upgradeWebSocket.bind(Deno)
    : undefined;

/** An abstraction which wraps a {@linkcode Request} from Deno's flash server.
 * The constructor takes a {@linkcode Deferred} which it will resolve when the
 * response is ready.
 *
 * This request can be used in situations where there isn't a specific method
 * to respond with, but where a `Promise<Response>` is accepted as a value. It
 * is specifically designed to work with Deno's flash server.
 */
export class HttpRequest implements ServerRequest {
  #deferred: Deferred<Response>;
  #request: Request;
  #resolved = false;
  #upgradeWebSocket?: UpgradeWebSocketFn;

  get remoteAddr(): string | undefined {
    return undefined;
  }

  get headers(): Headers {
    return this.#request.headers;
  }

  get method(): string {
    return this.#request.method;
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

  constructor(
    request: Request,
    deferred: Deferred<Response>,
    upgradeWebSocket?: UpgradeWebSocketFn,
  ) {
    this.#deferred = deferred;
    this.#request = request;
    this.#upgradeWebSocket = upgradeWebSocket ?? maybeUpgradeWebSocket;
  }

  // deno-lint-ignore no-explicit-any
  error(reason?: any): void {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#deferred.reject(reason);
    this.#resolved = true;
  }

  getBody(): ServerRequestBody {
    return {
      body: this.#request.body,
      readBody: async () => {
        const ab = await this.#request.arrayBuffer();
        return new Uint8Array(ab);
      },
    };
  }

  respond(response: Response): Promise<void> {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    this.#deferred.resolve(response);
    this.#resolved = true;
    return Promise.resolve();
  }

  upgrade(options?: UpgradeWebSocketOptions): WebSocket {
    if (this.#resolved) {
      throw new Error("Request already responded to.");
    }
    if (!this.#upgradeWebSocket) {
      throw new TypeError("Upgrading web sockets not supported.");
    }
    const { response, socket } = this.#upgradeWebSocket(this.#request, options);
    this.#deferred.resolve(response);
    return socket;
  }
}
