// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { contentType, Status } from "./deps.ts";
import { Request } from "./request.ts";
import { isHtml, isRedirectStatus } from "./util.ts";

interface ServerResponse {
  status?: number;
  headers?: Headers;
  body?: Uint8Array | Deno.Reader;
}

export const REDIRECT_BACK = Symbol("redirect backwards");

const BODY_TYPES = ["string", "number", "bigint", "boolean", "symbol"];

const encoder = new TextEncoder();

/** Guard for `Deno.Reader`. */
function isReader(value: any): value is Deno.Reader {
  return typeof value === "object" && "read" in value &&
    typeof value.read === "function";
}

export class Response {
  #request: Request;
  #writable = true;

  #getBody = (): Uint8Array | Deno.Reader | undefined => {
    const typeofBody = typeof this.body;
    let result: Uint8Array | Deno.Reader | undefined;
    this.#writable = false;
    if (BODY_TYPES.includes(typeofBody)) {
      const bodyText = String(this.body);
      result = encoder.encode(bodyText);
      this.type = this.type || (isHtml(bodyText) ? "html" : "text/plain");
    } else if (this.body instanceof Uint8Array || isReader(this.body)) {
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

  constructor(request: Request) {
    this.#request = request;
  }

  /** Sets the response to redirect to the supplied `url`.
   * 
   * If the `.status` is not currently a redirect status, the status will be set
   * to `302 Found`.
   * 
   * The body will be set to a message indicating the redirection is occurring.
   */
  redirect(url: string | URL): void;
  /** Sets the response to redirect back to the referrer if available, with an
   * optional `alt` URL if there is no referrer header on the request.  If there
   * is no referrer header, nor an `alt` parameter, the redirect is set to `/`.
   * 
   * If the `.status` is not currently a redirect status, the status will be set
   * to `302 Found`.
   * 
   * The body will be set to a message indicating the redirection is occurring.
   */
  redirect(url: typeof REDIRECT_BACK, alt?: string | URL): void;
  redirect(
    url: string | URL | typeof REDIRECT_BACK,
    alt: string | URL = "/",
  ): void {
    if (url === REDIRECT_BACK) {
      url = this.#request.headers.get("Referrer") ?? String(alt);
    } else if (typeof url === "object") {
      url = String(url);
    }
    this.headers.set("Location", encodeURI(url));
    if (!this.status || !isRedirectStatus(this.status)) {
      this.status = Status.Found;
    }

    if (this.#request.accepts("html")) {
      url = encodeURI(url);
      this.type = "text/html; charset=utf-8";
      this.body = `Redirecting to <a href="${url}">${url}</a>.`;
      return;
    }
    this.type = "text/plain; charset=utf-8";
    this.body = `Redirecting to ${url}.`;
  }

  /** Take this response and convert it to the response used by the Deno net
   * server. */
  toServerResponse(): ServerResponse {
    // Process the body
    const body = this.#getBody();

    // If there is a response type, set the content type header
    this.#setContentType();

    const { headers, status } = this;

    // If there is no body and no content type and no set length, then set the
    // content length to 0
    if (
      !(
        body ||
        headers.has("Content-Type") ||
        headers.has("Content-Length")
      )
    ) {
      headers.append("Content-Length", "0");
    }

    return {
      status: status ?? (body ? Status.OK : Status.NotFound),
      body,
      headers,
    };
  }
}
