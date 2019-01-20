// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { contentType, Status } from "./deps.ts";

interface ServerResponse {
  status?: number;
  headers?: Headers;
  body?: Uint8Array;
}

const BODY_TYPES = ["string", "number", "bigint", "boolean", "symbol"];

const encoder = new TextEncoder();

function isHtml(value: string): boolean {
  return /^\s*<(?:!DOCTYPE|html|body)/i.test(value);
}

export class Response {
  private _getBody(): Uint8Array | undefined {
    const typeofBody = typeof this.body;
    let result: Uint8Array | undefined;
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
  }

  private _setContentType() {
    if (this.type) {
      const contentTypeString = contentType(this.type);
      if (contentTypeString && !this.headers.has("Content-Type")) {
        this.headers.append("Content-Type", contentTypeString);
      }
    }
  }

  /** The body of the response */
  body?: any;

  /** Headers that will be returned in the response */
  headers = new Headers();

  /** The HTTP status of the response */
  status?: Status;

  /** The media type, or extension of the response */
  type?: string;

  /** Take this response and convert it to the response used by the Deno net
   * server. */
  toServerResponse(): ServerResponse {
    // Process the body
    const body = this._getBody();

    // If there is a response type, set the content type header
    this._setContentType();

    return {
      status: this.status || (body ? Status.OK : Status.NotFound),
      body,
      headers: this.headers
    };
  }
}
