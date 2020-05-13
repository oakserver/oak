// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { contentType, Status } from "./deps.ts";
import { isHtml } from "./util.ts";

interface ServerResponse {
  status?: number;
  headers?: Headers;
  body?: Uint8Array;
}

const BODY_TYPES = ["string", "number", "bigint", "boolean", "symbol"];

const encoder = new TextEncoder();

export class Response {
  #writable = true;

  #getBody = (): Uint8Array | undefined => {
    const typeofBody = typeof this.body;
    let result: Uint8Array | undefined;
    this.#writable = false;
    if (BODY_TYPES.includes(typeofBody)) {
      const bodyText = String(this.body);
      result = encoder.encode(bodyText);
      this.type = this.type || (isHtml(bodyText) ? "html" : "text/plain");
    } else if (this.body instanceof Uint8Array) {
      result = this.body;
    } else if (typeofBody === "object" && this.body !== null) {
      result = encoder.encode(JSON.stringify(this.body));
      this.type = this.type || "json";
    }
    return result;
  };

  #setContentType = (): void => {
    if (this.type) {
      const contentTypeString = contentType(this.type);
      if (contentTypeString && !this.headers.has("Content-Type")) {
        this.headers.append("Content-Type", contentTypeString);
      }
    }
  };

  /** The body of the response */
  body?: any;

  /** Headers that will be returned in the response */
  headers = new Headers();

  /** The HTTP status of the response */
  status?: Status;

  /** The media type, or extension of the response */
  type?: string;

  get writable(): boolean {
    return this.#writable;
  }

  /** Take this response and convert it to the response used by the Deno net
   * server. */
  toServerResponse(): ServerResponse {
    // Process the body
    const body = this.#getBody();

    // If there is a response type, set the content type header
    this.#setContentType();

    // If there is no body and no content type and no set length, then set the
    // content length to 0
    if (
      !(
        body ||
        this.headers.has("Content-Type") ||
        this.headers.has("Content-Length")
      )
    ) {
      this.headers.append("Content-Length", "0");
    }

    return {
      status: this.status || (body ? Status.OK : Status.NotFound),
      body,
      headers: this.headers,
    };
  }
}
