// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import type {
  RequestEvent,
  ServerRequest,
  ServerRequestBody,
  UpgradeWebSocketFn,
  UpgradeWebSocketOptions,
} from "./types.d.ts";

// deno-lint-ignore no-explicit-any
export const DomResponse: typeof Response = (globalThis as any).Response ??
  class MockResponse {};

const maybeUpgradeWebSocket: UpgradeWebSocketFn | undefined =
  "upgradeWebSocket" in Deno
    ? // deno-lint-ignore no-explicit-any
      (Deno as any).upgradeWebSocket.bind(Deno)
    : undefined;

export interface NativeRequestOptions {
  conn?: Deno.Conn;
  upgradeWebSocket?: UpgradeWebSocketFn;
}

/** An internal oak abstraction for handling a Deno native request. Most users
 * of oak do not need to worry about this abstraction. */
export class NativeRequest implements ServerRequest {
  #conn?: Deno.Conn;
  // deno-lint-ignore no-explicit-any
  #reject!: (reason?: any) => void;
  #request: Request;
  #requestPromise: Promise<void>;
  #resolve!: (value: Response) => void;
  #resolved = false;
  #upgradeWebSocket?: UpgradeWebSocketFn;

  constructor(
    requestEvent: RequestEvent,
    options: NativeRequestOptions = {},
  ) {
    const { conn } = options;
    this.#conn = conn;
    // this allows for the value to be explicitly undefined in the options
    this.#upgradeWebSocket = "upgradeWebSocket" in options
      ? options["upgradeWebSocket"]
      : maybeUpgradeWebSocket;
    this.#request = requestEvent.request;
    const p = new Promise<Response>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
    this.#requestPromise = requestEvent.respondWith(p);
  }

  get body(): ReadableStream<Uint8Array> | null {
    // when shimming with undici under Node.js, this is a
    // `ControlledAsyncIterable`
    // deno-lint-ignore no-explicit-any
    return this.#request.body as any;
  }

  get donePromise(): Promise<void> {
    return this.#requestPromise;
  }

  get headers(): Headers {
    return this.#request.headers;
  }

  get method(): string {
    return this.#request.method;
  }

  get remoteAddr(): string | undefined {
    return (this.#conn?.remoteAddr as Deno.NetAddr)?.hostname;
  }

  get request(): Request {
    return this.#request;
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

  getBody(): ServerRequestBody {
    return {
      // when emitting to Node.js, the body is not compatible, and thought it
      // doesn't run at runtime, it still gets type checked.
      // deno-lint-ignore no-explicit-any
      body: this.#request.body as any,
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
    this.#resolve(response);
    this.#resolved = true;
    return this.#requestPromise;
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
