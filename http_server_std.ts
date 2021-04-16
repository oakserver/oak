// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type { Application, State } from "./application.ts";
import { serve, serveTLS } from "./deps.ts";
import type { BufReader, BufWriter } from "./deps.ts";
import type { Server } from "./types.d.ts";
import { isListenTlsOptions } from "./util.ts";

interface StdServer extends AsyncIterable<ServerRequest> {
  close(): void;
  [Symbol.asyncIterator](): AsyncIterableIterator<ServerRequest>;
}

/** An interface that aligns to the parts of `std/http/server`'s
 * `ServerRequest` that actually is consumed by oak. */
export interface ServerRequest {
  body: Deno.Reader;
  conn: Deno.Conn;
  headers: Headers;
  method: string;
  r: BufReader;
  respond(response: ServerResponse): Promise<void>;
  url: string;
  w: BufWriter;
}

/** An interface that aligns to what oak returns and is compatible with
 * `std/http/server`'s `request.respond()`. */
export interface ServerResponse {
  status: number;
  headers: Headers;
  body: Uint8Array | Deno.Reader | undefined;
}

// deno-lint-ignore no-explicit-any
export class HttpServerStd<AS extends State = Record<string, any>>
  implements Server<ServerRequest> {
  #server: StdServer;

  constructor(
    _app: Application<AS>,
    options: Deno.ListenOptions | Deno.ListenTlsOptions,
  ) {
    this.#server = isListenTlsOptions(options)
      ? serveTLS(options)
      : serve(options);
  }

  close(): void {
    this.#server.close();
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<ServerRequest> {
    return this.#server[Symbol.asyncIterator]();
  }
}
