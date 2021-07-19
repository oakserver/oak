// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import {
  isWebSocketCloseEvent,
  isWebSocketPingEvent,
  isWebSocketPongEvent,
  WebSocketStd,
} from "./deps.ts";

export interface UpgradeWebSocketOptions {
  protocol?: string;
}

/** A shim which takes a `std` library WebSocket and converts it into a web
 * standard `WebSocket` which is natively supported by Deno. */
export class WebSocketShim extends EventTarget implements WebSocket {
  #binaryType: BinaryType = "blob";
  #protocol = "";
  #readyState = WebSocket.CONNECTING;
  #socket: WebSocketStd;
  #url: string;
  #wasClean = false;

  #getBinaryData(data: Uint8Array): ArrayBuffer | Blob {
    if (this.#binaryType === "arraybuffer") {
      return data.buffer;
    }
    return new Blob([data]);
  }

  #listen() {
    queueMicrotask(async () => {
      for await (const event of this.#socket) {
        if (this.#readyState === WebSocket.CONNECTING) {
          this.#readyState = WebSocket.OPEN;
          this.dispatchEvent(new Event("open", { cancelable: false }));
        }
        if (
          this.#readyState === WebSocket.CLOSING &&
          !isWebSocketCloseEvent(event)
        ) {
          const error = new Error("Received an event while closing.");
          this.dispatchEvent(
            new ErrorEvent("error", { error, cancelable: false }),
          );
        }
        if (isWebSocketCloseEvent(event)) {
          this.#readyState = WebSocket.CLOSED;
          const { code, reason } = event;
          const wasClean = this.#wasClean;
          this.dispatchEvent(
            new CloseEvent("close", {
              code,
              reason,
              wasClean,
              cancelable: false,
            }),
          );
          return;
        } else if (isWebSocketPingEvent(event) || isWebSocketPongEvent(event)) {
          const [type, data] = event;
          this.dispatchEvent(
            new MessageEvent("message", { data: type, cancelable: false }),
          );
          this.dispatchEvent(
            new MessageEvent("message", { data, cancelable: false }),
          );
        } else {
          const data = typeof event === "string"
            ? event
            : this.#getBinaryData(event);
          this.dispatchEvent(
            new MessageEvent("message", { data, cancelable: false }),
          );
        }
        if (this.#readyState === WebSocket.CLOSED) {
          return;
        }
      }
    });
  }

  get binaryType(): BinaryType {
    return this.#binaryType;
  }

  set binaryType(value: BinaryType) {
    this.#binaryType = value;
  }

  get bufferedAmount(): number {
    return 0;
  }

  get extensions(): string {
    return "";
  }

  // deno-lint-ignore no-explicit-any
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
  // deno-lint-ignore no-explicit-any
  onerror: ((this: WebSocket, ev: Event | ErrorEvent) => any) | null = null;
  // deno-lint-ignore no-explicit-any
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
  // deno-lint-ignore no-explicit-any
  onopen: ((this: WebSocket, ev: Event) => any) | null = null;

  get protocol(): string {
    return this.#protocol;
  }

  get readyState(): number {
    return this.#readyState;
  }

  get url(): string {
    return this.#url;
  }

  constructor(
    socket: WebSocketStd,
    url: string,
    protocol: string = "",
  ) {
    super();
    this.#protocol = protocol;
    this.#socket = socket;
    this.#url = url;
    this.#listen();
  }

  close(code?: number, reason?: string): void {
    queueMicrotask(async () => {
      try {
        this.#readyState = WebSocket.CLOSING;
        // std has bad typings here 😭
        await this.#socket.close(code as number, reason as string);
        this.#wasClean = true;
      } catch (error) {
        this.dispatchEvent(new ErrorEvent("error", { error }));
      }
    });
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    queueMicrotask(async () => {
      try {
        let d: string | Uint8Array;
        if (typeof data === "string") {
          d = data;
        } else if (data instanceof Blob) {
          d = new Uint8Array(await data.arrayBuffer());
        } else if (ArrayBuffer.isView(data)) {
          d = new Uint8Array(data.buffer);
        } else {
          d = new Uint8Array(data);
        }
        await this.#socket.send(d);
      } catch (error) {
        this.dispatchEvent(
          new ErrorEvent("error", { error, cancelable: false }),
        );
      }
    });
  }

  dispatchEvent(event: Event) {
    if (event.type === "error" && this.onerror) {
      this.onerror.call(this, event);
    } else if (
      event.type === "close" && event instanceof CloseEvent && this.onclose
    ) {
      this.onclose.call(this, event);
    } else if (
      event.type === "message" && event instanceof MessageEvent &&
      this.onmessage
    ) {
      this.onmessage.call(this, event);
    } else if (event.type === "open" && this.onopen) {
      this.onopen.call(this, event);
    }
    if (!event.defaultPrevented) {
      return super.dispatchEvent(event);
    } else {
      return false;
    }
  }

  get CLOSED() {
    return WebSocket.CLOSED;
  }

  get CLOSING() {
    return WebSocket.CLOSING;
  }

  get CONNECTING() {
    return WebSocket.CONNECTING;
  }

  get OPEN() {
    return WebSocket.OPEN;
  }
}
