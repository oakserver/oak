// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { AsyncIterableReader } from "./async_iterable_reader.ts";
import {
  contentType,
  readerFromStreamReader,
  Status,
  STATUS_TEXT,
} from "./deps.ts";
import { DomResponse } from "./http_server_native.ts";
import type { ServerResponse } from "./http_server_std.ts";
import type { Request } from "./request.ts";
import {
  BODY_TYPES,
  encodeUrl,
  isAsyncIterable,
  isHtml,
  isReader,
  isRedirectStatus,
  readableStreamFromReader,
  Uint8ArrayTransformStream,
} from "./util.ts";

type Body =
  | string
  | number
  | bigint
  | boolean
  | symbol
  // deno-lint-ignore ban-types
  | object
  | undefined
  | null;
type BodyFunction = () => Body | Promise<Body>;

/** A symbol that indicates to `response.redirect()` to attempt to redirect
 * back to the request referrer.  For example:
 *
 * ```ts
 * import { Application, REDIRECT_BACK } from "https://deno.land/x/oak/mod.ts";
 *
 * const app = new Application();
 *
 * app.use((ctx) => {
 *   if (ctx.request.url.pathName === "/back") {
 *     ctx.response.redirect(REDIRECT_BACK, "/");
 *   }
 * });
 *
 * await app.listen({ port: 80 });
 * ```
 */
export const REDIRECT_BACK = Symbol("redirect backwards");

const encoder = new TextEncoder();

function toUint8Array(body: Body): Uint8Array {
  let bodyText: string;
  if (BODY_TYPES.includes(typeof body)) {
    bodyText = String(body);
  } else {
    bodyText = JSON.stringify(body);
  }
  return encoder.encode(bodyText);
}

async function convertBodyToBodyInit(
  body: Body | BodyFunction,
  type?: string,
): Promise<[globalThis.BodyInit | undefined, string | undefined]> {
  let result: globalThis.BodyInit | undefined;
  if (BODY_TYPES.includes(typeof body)) {
    result = String(body);
    type = type ?? (isHtml(result) ? "html" : "text/plain");
  } else if (isReader(body)) {
    result = readableStreamFromReader(body);
  } else if (
    ArrayBuffer.isView(body) || body instanceof ArrayBuffer ||
    body instanceof Blob || body instanceof URLSearchParams
  ) {
    result = body;
  } else if (body instanceof ReadableStream) {
    result = body.pipeThrough(new Uint8ArrayTransformStream());
  } else if (body instanceof FormData) {
    result = body;
    type = "multipart/form-data";
  } else if (body && typeof body === "object") {
    result = JSON.stringify(body);
    type = type ?? "json";
  } else if (typeof body === "function") {
    const result = body.call(null);
    return convertBodyToBodyInit(await result, type);
  } else if (body) {
    throw new TypeError("Response body was set but could not be converted.");
  }
  return [result, type];
}

async function convertBodyToStdBody(
  body: Body | BodyFunction,
  type?: string,
): Promise<[Uint8Array | Deno.Reader | undefined, string | undefined]> {
  let result: Uint8Array | Deno.Reader | undefined;
  if (BODY_TYPES.includes(typeof body)) {
    const bodyText = String(body);
    result = encoder.encode(bodyText);
    type = type ?? (isHtml(bodyText) ? "html" : "text/plain");
  } else if (body instanceof Uint8Array || isReader(body)) {
    result = body;
  } else if (body instanceof ReadableStream) {
    result = readerFromStreamReader(
      body.pipeThrough(new Uint8ArrayTransformStream()).getReader(),
    );
  } else if (isAsyncIterable(body)) {
    result = new AsyncIterableReader(body, toUint8Array);
  } else if (body && typeof body === "object") {
    result = encoder.encode(JSON.stringify(body));
    type = type ?? "json";
  } else if (typeof body === "function") {
    const result = body.call(null);
    return convertBodyToStdBody(await result, type);
  } else if (body) {
    throw new TypeError("Response body was set but could not be converted.");
  }
  return [result, type];
}

/** An interface to control what response will be sent when the middleware
 * finishes processing the request. */
export class Response {
  #body?: Body | BodyFunction;
  #bodySet = false;
  #domResponse?: globalThis.Response;
  #headers = new Headers();
  #request: Request;
  #resources: number[] = [];
  #serverResponse?: ServerResponse;
  #status?: Status;
  #type?: string;
  #writable = true;

  async #getBodyInit(): Promise<globalThis.BodyInit | undefined> {
    const [body, type] = await convertBodyToBodyInit(this.body, this.type);
    this.type = type;
    return body;
  }

  async #getStdBody(): Promise<Uint8Array | Deno.Reader | undefined> {
    const [body, type] = await convertBodyToStdBody(this.body, this.type);
    this.type = type;
    return body;
  }

  #setContentType(): void {
    if (this.type) {
      const contentTypeString = contentType(this.type);
      if (contentTypeString && !this.headers.has("Content-Type")) {
        this.headers.append("Content-Type", contentTypeString);
      }
    }
  }

  /** The body of the response.  The body will be automatically processed when
   * the response is being sent and converted to a `Uint8Array` or a
   * `Deno.Reader`.
   *
   * Automatic conversion to a `Deno.Reader` occurs for async iterables. */
  get body(): Body | BodyFunction {
    return this.#body;
  }

  /** The body of the response.  The body will be automatically processed when
   * the response is being sent and converted to a `Uint8Array` or a
   * `Deno.Reader`.
   *
   * Automatic conversion to a `Deno.Reader` occurs for async iterables. */
  set body(value: Body | BodyFunction) {
    if (!this.#writable) {
      throw new Error("The response is not writable.");
    }
    this.#bodySet = true;
    this.#body = value;
  }

  /** Headers that will be returned in the response. */
  get headers(): Headers {
    return this.#headers;
  }

  /** Headers that will be returned in the response. */
  set headers(value: Headers) {
    if (!this.#writable) {
      throw new Error("The response is not writable.");
    }
    this.#headers = value;
  }

  /** The HTTP status of the response.  If this has not been explicitly set,
   * reading the value will return what would be the value of status if the
   * response were sent at this point in processing the middleware.  If the body
   * has been set, the status will be `200 OK`.  If a value for the body has
   * not been set yet, the status will be `404 Not Found`. */
  get status(): Status {
    if (this.#status) {
      return this.#status;
    }
    return this.body != null
      ? Status.OK
      : this.#bodySet
      ? Status.NoContent
      : Status.NotFound;
  }

  /** The HTTP status of the response.  If this has not been explicitly set,
   * reading the value will return what would be the value of status if the
   * response were sent at this point in processing the middleware.  If the body
   * has been set, the status will be `200 OK`.  If a value for the body has
   * not been set yet, the status will be `404 Not Found`. */
  set status(value: Status) {
    if (!this.#writable) {
      throw new Error("The response is not writable.");
    }
    this.#status = value;
  }

  /** The media type, or extension of the response.  Setting this value will
   * ensure an appropriate `Content-Type` header is added to the response. */
  get type(): string | undefined {
    return this.#type;
  }
  /** The media type, or extension of the response.  Setting this value will
   * ensure an appropriate `Content-Type` header is added to the response. */
  set type(value: string | undefined) {
    if (!this.#writable) {
      throw new Error("The response is not writable.");
    }
    this.#type = value;
  }

  /** A read-only property which determines if the response is writable or not.
   * Once the response has been processed, this value is set to `false`. */
  get writable(): boolean {
    return this.#writable;
  }

  constructor(request: Request) {
    this.#request = request;
  }

  /** Add a resource to the list of resources that will be closed when the
   * request is destroyed. */
  addResource(rid: number): void {
    this.#resources.push(rid);
  }

  /** Release any resources that are being tracked by the response.
   *
   * @param closeResources close any resource IDs registered with the response
   */
  destroy(closeResources = true): void {
    this.#writable = false;
    this.#body = undefined;
    this.#serverResponse = undefined;
    this.#domResponse = undefined;
    if (closeResources) {
      for (const rid of this.#resources) {
        Deno.close(rid);
      }
    }
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
      url = this.#request.headers.get("Referer") ?? String(alt);
    } else if (typeof url === "object") {
      url = String(url);
    }
    this.headers.set("Location", encodeUrl(url));
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

  async toDomResponse(): Promise<globalThis.Response> {
    if (this.#domResponse) {
      return this.#domResponse;
    }

    const bodyInit = await this.#getBodyInit();

    this.#setContentType();

    const { headers } = this;

    // If there is no body and no content type and no set length, then set the
    // content length to 0
    if (
      !(
        bodyInit ||
        headers.has("Content-Type") ||
        headers.has("Content-Length")
      )
    ) {
      headers.append("Content-Length", "0");
    }

    this.#writable = false;

    const status = this.status;
    const responseInit: ResponseInit = {
      headers,
      status,
      statusText: STATUS_TEXT.get(status),
    };

    return this.#domResponse = new DomResponse(bodyInit, responseInit);
  }

  /** Take this response and convert it to the response used by the Deno net
   * server.  Calling this will set the response to not be writable.
   *
   * Most users will have no need to call this method. */
  async toServerResponse(): Promise<ServerResponse> {
    if (this.#serverResponse) {
      return this.#serverResponse;
    }
    // Process the body
    const body = await this.#getStdBody();

    // If there is a response type, set the content type header
    this.#setContentType();

    const { headers } = this;

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

    this.#writable = false;
    return this.#serverResponse = {
      body,
      headers,
      status: this.status,
    };
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    const { body, headers, status, type, writable } = this;
    return `Response ${inspect({ body, headers, status, type, writable })}`;
  }
}
