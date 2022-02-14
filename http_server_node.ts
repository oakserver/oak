// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import type { Listener, Server, ServerRequest } from "./types.d.ts";

import * as http from "http";
// import * as http2 from "http2";

export class NodeRequest implements ServerRequest {
  get remoteAddr(): string | undefined {
    return undefined;
  }

  get headers(): Headers {
    return new Headers();
  }

  get method(): string {
    return "GET";
  }

  get rawUrl(): string {
    return "";
  }

  get request(): Request {
    return new Request("https://deno.land/x/");
  }

  get url(): string {
    return "";
  }

  error() {}

  respond() {
    return Promise.resolve();
  }
}

export class HttpServerNode implements Server<NodeRequest> {
  #abortController = new AbortController();
  #host: string;
  #port: number;
  #server;

  constructor() {
    this.#host = `localhost`;
    this.#port = 0;
    this.#server = http.createServer((req, res) => {});
  }

  close(): void {
    this.#abortController.abort();
  }

  listen(): Listener {
    this.#server.listen({
      port: this.#port,
      host: this.#host,
      signal: this.#abortController.signal,
    });
    return {
      addr: {
        port: this.#port,
        hostname: this.#host,
      },
    };
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<NodeRequest> {}
}
