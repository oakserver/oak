// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type { Context } from "./context.ts";
import { assert } from "./util.ts";

const encoder = new TextEncoder();

const DEFAULT_KEEP_ALIVE_INTERVAL = 30_000;

export interface ServerSentEventInit extends EventInit {
  /** An optional `id` which will be sent with the event and exposed in the
   * client `EventSource`. */
  id?: number;

  /** The replacer is passed to `JSON.stringify` when converting the `data`
   * property to a JSON string. */
  replacer?:
    | (string | number)[]
    // deno-lint-ignore no-explicit-any
    | ((this: any, key: string, value: any) => any);

  /** Space is passed to `JSON.stringify` when converting the `data` property
   * to a JSON string. */
  space?: string | number;
}

export interface ServerSentEventTargetOptions {
  /** Additional headers to send to the client during startup.  These headers
   * will overwrite any of the default headers if the key is duplicated. */
  headers?: Headers;
  /** Keep client connections alive by sending a comment event to the client
   * at a specified interval.  If `true`, then it polls every 30000 milliseconds
   * (30 seconds). If set to a number, then it polls that number of
   * milliseconds.  The feature is disabled if set to `false`.  It defaults to
   * `false`. */
  keepAlive?: boolean | number;
}

class CloseEvent extends Event {
  constructor(eventInit: EventInit) {
    super("close", eventInit);
  }
}

/** An event which contains information which will be sent to the remote
 * connection and be made available in an `EventSource` as an event. */
export class ServerSentEvent extends Event {
  #data: string;
  #id?: number;
  #type: string;

  constructor(
    type: string,
    // deno-lint-ignore no-explicit-any
    data: any,
    { replacer, space, ...eventInit }: ServerSentEventInit = {},
  ) {
    super(type, eventInit);
    this.#type = type;
    try {
      this.#data = typeof data === "string"
        ? data
        : JSON.stringify(data, replacer as (string | number)[], space);
    } catch (e) {
      assert(e instanceof Error);
      throw new TypeError(
        `data could not be coerced into a serialized string.\n  ${e.message}`,
      );
    }
    const { id } = eventInit;
    this.#id = id;
  }

  /** The data associated with the event, which will be sent to the client and
   * be made available in the `EventSource`. */
  get data(): string {
    return this.#data;
  }

  /** The optional ID associated with the event that will be sent to the client
   * and be made available in the `EventSource`. */
  get id(): number | undefined {
    return this.#id;
  }

  toString(): string {
    const data = `data: ${this.#data.split("\n").join("\ndata: ")}\n`;
    return `${this.#type === "__message" ? "" : `event: ${this.#type}\n`}${
      this.#id ? `id: ${String(this.#id)}\n` : ""
    }${data}\n`;
  }
}

const responseHeaders = new Headers(
  [
    ["Connection", "Keep-Alive"],
    ["Content-Type", "text/event-stream"],
    ["Cache-Control", "no-cache"],
    ["Keep-Alive", `timeout=${Number.MAX_SAFE_INTEGER}`],
  ],
);

export interface ServerSentEventTarget extends EventTarget {
  /** Is set to `true` if events cannot be sent to the remote connection.
   * Otherwise it is set to `false`.
   *
   * *Note*: This flag is lazily set, and might not reflect a closed state until
   * another event, comment or message is attempted to be processed. */
  readonly closed: boolean;

  /** Close the target, refusing to accept any more events. */
  close(): Promise<void>;

  /** Send a comment to the remote connection.  Comments are not exposed to the
   * client `EventSource` but are used for diagnostics and helping ensure a
   * connection is kept alive.
   *
   * ```ts
   * import { Application } from "https://deno.land/x/oak/mod.ts";
   *
   * const app = new Application();
   *
   * app.use((ctx) => {
   *    const sse = ctx.getSSETarget();
   *    sse.dispatchComment("this is a comment");
   * });
   *
   * await app.listen();
   * ```
   */
  dispatchComment(comment: string): boolean;

  /** Dispatch a message to the client.  This message will contain `data: ` only
   * and be available on the client `EventSource` on the `onmessage` or an event
   * listener of type `"message"`. */
  // deno-lint-ignore no-explicit-any
  dispatchMessage(data: any): boolean;

  /** Dispatch a server sent event to the client.  The event `type` will be
   * sent as `event: ` to the client which will be raised as a `MessageEvent`
   * on the `EventSource` in the client.
   *
   * Any local event handlers will be dispatched to first, and if the event
   * is cancelled, it will not be sent to the client.
   *
   * ```ts
   * import { Application, ServerSentEvent } from "https://deno.land/x/oak/mod.ts";
   *
   * const app = new Application();
   *
   * app.use((ctx) => {
   *    const sse = ctx.getSSETarget();
   *    const evt = new ServerSentEvent("ping", "hello");
   *    sse.dispatchEvent(evt);
   * });
   *
   * await app.listen();
   * ```
   */
  dispatchEvent(event: ServerSentEvent): boolean;

  /** Dispatch a server sent event to the client.  The event `type` will be
   * sent as `event: ` to the client which will be raised as a `MessageEvent`
   * on the `EventSource` in the client.
   *
   * Any local event handlers will be dispatched to first, and if the event
   * is cancelled, it will not be sent to the client.
   *
   * ```ts
   * import { Application, ServerSentEvent } from "https://deno.land/x/oak/mod.ts";
   *
   * const app = new Application();
   *
   * app.use((ctx) => {
   *    const sse = ctx.getSSETarget();
   *    const evt = new ServerSentEvent("ping", "hello");
   *    sse.dispatchEvent(evt);
   * });
   *
   * await app.listen();
   * ```
   */
  dispatchEvent(event: CloseEvent | ErrorEvent): boolean;
}

export class SSEStreamTarget extends EventTarget
  implements ServerSentEventTarget {
  #closed = false;
  #context: Context;
  #controller?: ReadableStreamDefaultController<Uint8Array>;
  #keepAliveId?: number;

  // deno-lint-ignore no-explicit-any
  #error(error: any) {
    console.log("error", error);
    this.dispatchEvent(new CloseEvent({ cancelable: false }));
    const errorEvent = new ErrorEvent("error", { error });
    this.dispatchEvent(errorEvent);
    this.#context.app.dispatchEvent(errorEvent);
  }

  #push(payload: string) {
    if (!this.#controller) {
      this.#error(new Error("The controller has not been set."));
      return;
    }
    if (this.#closed) {
      return;
    }
    this.#controller.enqueue(encoder.encode(payload));
  }

  get closed(): boolean {
    return this.#closed;
  }

  constructor(
    context: Context,
    { headers, keepAlive = false }: ServerSentEventTargetOptions = {},
  ) {
    super();

    this.#context = context;

    context.response.body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.#controller = controller;
      },
      cancel: (error) => {
        // connections closing are considered "normal" for SSE events and just
        // mean the far side has closed.
        if (
          error instanceof Error && error.message.includes("connection closed")
        ) {
          this.close();
        } else {
          this.#error(error);
        }
      },
    });

    if (headers) {
      for (const [key, value] of headers) {
        context.response.headers.set(key, value);
      }
    }
    for (const [key, value] of responseHeaders) {
      context.response.headers.set(key, value);
    }

    this.addEventListener("close", () => {
      this.#closed = true;
      if (this.#keepAliveId != null) {
        clearInterval(this.#keepAliveId);
        this.#keepAliveId = undefined;
      }
      if (this.#controller) {
        try {
          this.#controller.close();
        } catch {
          // we ignore any errors here, as it is likely that the controller
          // is already closed
        }
      }
    });

    if (keepAlive) {
      const interval = typeof keepAlive === "number"
        ? keepAlive
        : DEFAULT_KEEP_ALIVE_INTERVAL;
      this.#keepAliveId = setInterval(() => {
        this.dispatchComment("keep-alive comment");
      }, interval);
    }
  }

  close(): Promise<void> {
    this.dispatchEvent(new CloseEvent({ cancelable: false }));
    return Promise.resolve();
  }

  dispatchComment(comment: string): boolean {
    this.#push(`: ${comment.split("\n").join("\n: ")}\n\n`);
    return true;
  }

  // deno-lint-ignore no-explicit-any
  dispatchMessage(data: any): boolean {
    const event = new ServerSentEvent("__message", data);
    return this.dispatchEvent(event);
  }

  dispatchEvent(event: ServerSentEvent): boolean;
  dispatchEvent(event: CloseEvent | ErrorEvent): boolean;
  dispatchEvent(event: ServerSentEvent | CloseEvent | ErrorEvent): boolean {
    const dispatched = super.dispatchEvent(event);
    if (dispatched && event instanceof ServerSentEvent) {
      this.#push(String(event));
    }
    return dispatched;
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    return `${this.constructor.name} ${
      inspect({ "#closed": this.#closed, "#context": this.#context })
    }`;
  }
}
