// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/**
 * Contains the oak abstraction to represent a request {@linkcode Body}.
 *
 * This is not normally used directly by end users.
 *
 * @module
 */

import { createHttpError, matches, parseFormData, Status } from "./deps.ts";
import type { ServerRequest } from "./types.ts";

type JsonReviver = (key: string, value: unknown) => unknown;

export type BodyType =
  | "binary"
  | "form"
  | "form-data"
  | "json"
  | "text"
  | "unknown";

const KNOWN_BODY_TYPES: [bodyType: BodyType, knownMediaTypes: string[]][] = [
  ["binary", ["image", "audio", "application/octet-stream"]],
  ["form", ["urlencoded"]],
  ["form-data", ["multipart"]],
  ["json", ["json", "application/*+json", "application/csp-report"]],
  ["text", ["text"]],
];

async function readBlob(
  body?: ReadableStream<Uint8Array> | null,
  type?: string | null,
): Promise<Blob> {
  if (!body) {
    return new Blob(undefined, type ? { type } : undefined);
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) {
    chunks.push(chunk);
  }
  return new Blob(chunks, type ? { type } : undefined);
}

/** An object which encapsulates information around a request body. */
export class Body {
  #body?: ReadableStream<Uint8Array> | null;
  #headers?: Headers;
  #request?: Request;
  #reviver?: JsonReviver;
  #type?: BodyType;
  #used = false;

  constructor(
    serverRequest: Pick<ServerRequest, "request" | "headers" | "getBody">,
    reviver?: JsonReviver,
  ) {
    if (serverRequest.request) {
      this.#request = serverRequest.request;
    } else {
      this.#headers = serverRequest.headers;
      this.#body = serverRequest.getBody();
    }
    this.#reviver = reviver;
  }

  /** Is `true` if the request might have a body, otherwise `false`.
   *
   * **WARNING** this is an unreliable API. In HTTP/2 in many situations you
   * cannot determine if a request has a body or not unless you attempt to read
   * the body, due to the streaming nature of HTTP/2. As of Deno 1.16.1, for
   * HTTP/1.1, Deno also reflects that behavior.  The only reliable way to
   * determine if a request has a body or not is to attempt to read the body.
   */
  get has(): boolean {
    return !!(this.#request ? this.#request.body : this.#body);
  }

  /** Exposes the "raw" `ReadableStream` of the body. */
  get stream(): ReadableStream<Uint8Array> | null {
    return this.#request ? this.#request.body : this.#body!;
  }

  /** Returns `true` if the body has been consumed yet, otherwise `false`. */
  get used(): boolean {
    return this.#request?.bodyUsed ?? this.#used;
  }

  /** Reads a body to the end and resolves with the value as an
   * {@linkcode ArrayBuffer} */
  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.#request) {
      return this.#request.arrayBuffer();
    }
    this.#used = true;
    return (await readBlob(this.#body)).arrayBuffer();
  }

  /** Reads a body to the end and resolves with the value as a
   * {@linkcode Blob}. */
  blob(): Promise<Blob> {
    if (this.#request) {
      return this.#request.blob();
    }
    this.#used = true;
    return readBlob(this.#body, this.#headers?.get("content-type"));
  }

  /** Reads a body as a URL encoded form, resolving the value as
   * {@linkcode URLSearchParams}. */
  async form(): Promise<URLSearchParams> {
    const text = await this.text();
    return new URLSearchParams(text);
  }

  /** Reads a body to the end attempting to parse the body as a set of
   * {@linkcode FormData}. */
  formData(): Promise<FormData> {
    if (this.#request) {
      return this.#request.formData();
    }
    this.#used = true;
    if (this.#body && this.#headers) {
      const contentType = this.#headers.get("content-type");
      if (contentType) {
        return parseFormData(contentType, this.#body);
      }
    }
    throw createHttpError(Status.BadRequest, "Missing content type.");
  }

  /** Reads a body to the end attempting to parse the body as a JSON value.
   *
   * If a JSON reviver has been assigned, it will be used to parse the body.
   */
  // deno-lint-ignore no-explicit-any
  async json(): Promise<any> {
    try {
      if (this.#reviver) {
        const text = await this.text();
        return JSON.parse(text, this.#reviver);
      } else if (this.#request) {
        const value = await this.#request.json();
        return value;
      } else {
        this.#used = true;
        return JSON.parse(await (await readBlob(this.#body)).text());
      }
    } catch (err) {
      if (err instanceof Error) {
        throw createHttpError(Status.BadRequest, err.message);
      }
      throw createHttpError(Status.BadRequest, JSON.stringify(err));
    }
  }

  /** Reads the body to the end resolving with a string. */
  async text(): Promise<string> {
    if (this.#request) {
      return this.#request.text();
    }
    this.#used = true;
    return (await readBlob(this.#body)).text();
  }

  /** Attempts to determine what type of the body is to help determine how best
   * to attempt to decode the body. This performs analysis on the supplied
   * `Content-Type` header of the request.
   *
   * **Note** these are not authoritative and should only be used as guidance.
   *
   * There is the ability to provide custom types when attempting to discern
   * the type. Custom types are provided in the format of an object where the
   * key is on of {@linkcode BodyType} and the value is an array of media types
   * to attempt to match. Values supplied will be additive to known media types.
   *
   * The returned value is one of the following:
   *
   * - `"binary"` - The body appears to be binary data and should be consumed as
   *   an array buffer, readable stream or blob.
   * - `"form"` - The value appears to be an URL encoded form and should be
   *   consumed as a form (`URLSearchParams`).
   * - `"form-data"` - The value appears to be multipart form data and should be
   *   consumed as form data.
   * - `"json"` - The value appears to be JSON data and should be consumed as
   *   decoded JSON.
   * - `"text"` - The value appears to be text data and should be consumed as
   *   text.
   * - `"unknown"` - Either there is no body or the body type could not be
   *   determined.
   */
  type(customMediaTypes?: Partial<Record<BodyType, string[]>>): BodyType {
    if (this.#type && !customMediaTypes) {
      return this.#type;
    }
    customMediaTypes = customMediaTypes ?? {};
    const headers = this.#request?.headers ?? this.#headers;
    const contentType = headers?.get("content-type");
    if (contentType) {
      for (const [bodyType, knownMediaTypes] of KNOWN_BODY_TYPES) {
        const customTypes = customMediaTypes[bodyType] ?? [];
        if (matches(contentType, [...knownMediaTypes, ...customTypes])) {
          this.#type = bodyType;
          return this.#type;
        }
      }
    }
    return this.#type = "unknown";
  }

  [Symbol.for("Deno.customInspect")](
    inspect: (value: unknown) => string,
  ): string {
    const { has, used } = this;
    return `${this.constructor.name} ${inspect({ has, used })}`;
  }

  [Symbol.for("nodejs.util.inspect.custom")](
    depth: number,
    // deno-lint-ignore no-explicit-any
    options: any,
    inspect: (value: unknown, options?: unknown) => string,
    // deno-lint-ignore no-explicit-any
  ): any {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }

    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1,
    });
    const { has, used } = this;
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect(
        { has, used },
        newOptions,
      )
    }`;
  }
}
