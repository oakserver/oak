// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { type Application } from "./application.ts";
import { deferred } from "./deps.ts";
import { FlashRequest } from "./http_server_flash_request.ts";
import type { Listener, Server } from "./types.d.ts";
import { assert } from "./util.ts";

type ServeHandler = (
  request: Request,
) => Response | Promise<Response> | void | Promise<void>;

interface ServeInit {
  port?: number;
  hostname?: string;
  signal?: AbortSignal;
  onError?: (error: unknown) => Response | Promise<Response>;
  onListen?: (params: { hostname: string; port: number }) => void;
}

export interface ServeTlsInit extends ServeInit {
  cert: string;
  key: string;
}

type FlashServerOptions = Omit<Partial<ServeTlsInit>, "onListen" | "signal">;

const serve: (
  handler: ServeHandler,
  options?: ServeInit,
) => Promise<void> = "serve" in Deno
  // deno-lint-ignore no-explicit-any
  ? (Deno as any).serve.bind(Deno)
  : undefined;

const serveTls: (
  handler: ServeHandler,
  options?: ServeTlsInit,
) => Promise<void> = "serveTls" in Deno
  // deno-lint-ignore no-explicit-any
  ? (Deno as any).serveTls.bind(Deno)
  : undefined;

function isServeTlsInit(
  value: ServeInit | ServeTlsInit,
): value is ServeTlsInit {
  return "cert" in value && "key" in value;
}

/** A function that determines if the current environment supports Deno flash */
export function hasFlash(): boolean {
  // @ts-expect-error they might not actually be defined!
  return !!(serve && serveTls);
}

export class FlashServer implements Server<FlashRequest> {
  #abortController = new AbortController();
  #options: FlashServerOptions;
  #stream?: ReadableStream<FlashRequest>;

  // deno-lint-ignore no-explicit-any
  constructor(_app: Application<any>, options: FlashServerOptions) {
    if (!serve || !serveTls) {
      throw new Error("The flash bindings for serving HTTP are not available.");
    }
    this.#options = options;
  }

  close(): void {
    try {
      this.#abortController.abort();
      this.#stream?.cancel();
    } catch {
      // just swallow here
    }
  }

  listen(): Promise<Listener> {
    const p = deferred<Listener>();
    const start: ReadableStreamDefaultControllerCallback<FlashRequest> = (
      controller,
    ) => {
      const options: ServeInit | ServeTlsInit = {
        ...this.#options,
        signal: this.#abortController.signal,
        onListen: (addr) => p.resolve({ addr }),
      };
      const handler: ServeHandler = (request) => {
        const resolve = deferred<Response>();
        const flashRequest = new FlashRequest(request, resolve);
        controller.enqueue(flashRequest);
        return resolve;
      };
      if (isServeTlsInit(options)) {
        serveTls(handler, options);
      } else {
        serve(handler, options);
      }
    };
    this.#stream = new ReadableStream({ start });
    return p;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<FlashRequest> {
    assert(this.#stream, ".listen() was not called before iterating.");
    return this.#stream[Symbol.asyncIterator]();
  }
}
