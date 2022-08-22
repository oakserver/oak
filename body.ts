// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import { errors, readerFromStreamReader } from "./deps.ts";
import { isMediaType } from "./isMediaType.ts";
import { FormDataReader } from "./multipart.ts";
import type { ServerRequestBody } from "./types.d.ts";
import { assert } from "./util.ts";

/** The type of the body, where:
 *
 * - `"bytes"` - the body is provided as a promise which resolves to an
 *   {@linkcode Uint8Array}. This is essentially a "raw" body type.
 * - `"form"` - the body was decoded as a form with the contents provided as a
 *   promise which resolves with a {@linkcode URLSearchParams}.
 * - `"form-data"` - the body was decoded as a multi-part form data and the
 *   contents are provided as a promise which resolves with a
 *   {@linkcode FormDataReader}.
 * - `"json"` - the body was decoded as JSON, where the contents are provided as
 *   the result of using `JSON.parse()` on the string contents of the body.
 * - `"text"` - the body was decoded as text, where the contents are provided as
 *   a string.
 * - `"reader"` - the body is provided as {@linkcode Deno.Reader} interface for
 *   reading the "raw" body.
 * - `"stream"` - the body is provided as a
 *   {@linkcode ReadableStream<Uint8Array>} for reading the "raw" body.
 * - `"undefined"` - there is no request body or it could not be decoded.
 */
export type BodyType =
  | "bytes"
  | "form"
  | "form-data"
  | "json"
  | "text"
  | "reader"
  | "stream"
  | "undefined";

/** The tagged type for `"bytes"` bodies. */
export type BodyBytes = {
  readonly type: "bytes";
  readonly value: Promise<Uint8Array>;
};
/** The tagged type for `"json"` bodies. */
export type BodyJson = {
  readonly type: "json";
  // deno-lint-ignore no-explicit-any
  readonly value: Promise<any>;
};
/** The tagged type for `"form"` bodies. */
export type BodyForm = {
  readonly type: "form";
  readonly value: Promise<URLSearchParams>;
};
/** The tagged type for `"form-data"` bodies. */
export type BodyFormData = {
  readonly type: "form-data";
  readonly value: FormDataReader;
};
/** The tagged type for `"text"` bodies. */
export type BodyText = {
  readonly type: "text";
  readonly value: Promise<string>;
};
/** The tagged type for `"undefined"` bodies. */
export type BodyUndefined = {
  readonly type: "undefined";
  readonly value: undefined;
};
/** The tagged type for `"reader"` bodies. */
export type BodyReader = {
  readonly type: "reader";
  readonly value: Deno.Reader;
};
/** The tagged type for `"stream"` bodies. */
export type BodyStream = {
  readonly type: "stream";
  readonly value: ReadableStream<Uint8Array>;
};

/** The type returned from the `.body()` function, which is a tagged union type
 * of all the different types of bodies which can be identified by the `.type`
 * property which will be of type {@linkcode BodyType} and the `.value`
 * property being a `Promise` which resolves with the appropriate value, or
 * `undefined` if there is no body. */
export type Body =
  | BodyBytes
  | BodyJson
  | BodyForm
  | BodyFormData
  | BodyText
  | BodyUndefined;

type BodyValueGetter = () => Body["value"];

/** When setting the `contentTypes` property of {@linkcode BodyOptions}, provide
 * additional content types which can influence how the body is decoded. This
 * is specifically designed to allow a server to support custom or specialized
 * media types that are not part of the public database. */
export interface BodyOptionsContentTypes {
  /** Content types listed here will always return an Uint8Array. */
  bytes?: string[];
  /** Content types listed here will be parsed as a JSON string. */
  json?: string[];
  /** Content types listed here will be parsed as form data and return
   * `URLSearchParameters` as the value of the body. */
  form?: string[];
  /** Content types listed here will be parsed as from data and return a
   * `FormDataBody` interface as the value of the body. */
  formData?: string[];
  /** Content types listed here will be parsed as text. */
  text?: string[];
}

/** Options which can be used when accessing the `.body()` of a request.
 *
 * @template T the {@linkcode BodyType} to attempt to use when decoding the
 *             request body.
 */
export interface BodyOptions<T extends BodyType = BodyType> {
  /** When reading a non-streaming body, set a limit whereby if the content
   * length is greater then the limit or not set, reading the body will throw.
   *
   * This is to prevent malicious requests where the body exceeds the capacity
   * of the server. Set the limit to 0 to allow unbounded reads.  The default
   * is 10 Mib. */
  limit?: number;
  /** Instead of utilizing the content type of the request, attempt to parse the
   * body as the type specified. The value has to be of {@linkcode BodyType}. */
  type?: T;
  /** A map of extra content types to determine how to parse the body. */
  contentTypes?: BodyOptionsContentTypes;
}

export interface BodyContentTypes {
  json?: string[];
  form?: string[];
  text?: string[];
}

const DEFAULT_LIMIT = 10_485_760; // 10mb

const defaultBodyContentTypes = {
  json: ["json", "application/*+json", "application/csp-report"],
  form: ["urlencoded"],
  formData: ["multipart"],
  text: ["text"],
};

function resolveType(
  contentType: string,
  contentTypes: BodyOptionsContentTypes,
): BodyType {
  const contentTypesJson = [
    ...defaultBodyContentTypes.json,
    ...(contentTypes.json ?? []),
  ];
  const contentTypesForm = [
    ...defaultBodyContentTypes.form,
    ...(contentTypes.form ?? []),
  ];
  const contentTypesFormData = [
    ...defaultBodyContentTypes.formData,
    ...(contentTypes.formData ?? []),
  ];
  const contentTypesText = [
    ...defaultBodyContentTypes.text,
    ...(contentTypes.text ?? []),
  ];
  if (contentTypes.bytes && isMediaType(contentType, contentTypes.bytes)) {
    return "bytes";
  } else if (isMediaType(contentType, contentTypesJson)) {
    return "json";
  } else if (isMediaType(contentType, contentTypesForm)) {
    return "form";
  } else if (isMediaType(contentType, contentTypesFormData)) {
    return "form-data";
  } else if (isMediaType(contentType, contentTypesText)) {
    return "text";
  }
  return "bytes";
}

const decoder = new TextDecoder();

export class RequestBody {
  #body: ReadableStream<Uint8Array> | null;
  #formDataReader?: FormDataReader;
  #headers: Headers;
  #jsonBodyReviver?: (key: string, value: unknown) => unknown;
  #stream?: ReadableStream<Uint8Array>;
  #readAllBody?: Promise<Uint8Array>;
  #readBody: () => Promise<Uint8Array>;
  #type?: "bytes" | "form-data" | "reader" | "stream" | "undefined";

  #exceedsLimit(limit: number): boolean {
    if (!limit || limit === Infinity) {
      return false;
    }
    if (!this.#body) {
      return false;
    }
    const contentLength = this.#headers.get("content-length");
    if (!contentLength) {
      return true;
    }
    const parsed = parseInt(contentLength, 10);
    if (isNaN(parsed)) {
      return true;
    }
    return parsed > limit;
  }

  #parse(type: BodyType, limit: number): BodyValueGetter {
    switch (type) {
      case "form":
        this.#type = "bytes";
        if (this.#exceedsLimit(limit)) {
          return () =>
            Promise.reject(new RangeError(`Body exceeds a limit of ${limit}.`));
        }
        return async () =>
          new URLSearchParams(
            decoder.decode(await this.#valuePromise()).replace(/\+/g, " "),
          );
      case "form-data":
        this.#type = "form-data";
        return () => {
          const contentType = this.#headers.get("content-type");
          assert(contentType);
          const readableStream = this.#body ?? new ReadableStream();
          return this.#formDataReader ??
            (this.#formDataReader = new FormDataReader(
              contentType,
              readerFromStreamReader(
                (readableStream as ReadableStream<Uint8Array>).getReader(),
              ),
            ));
        };
      case "json":
        this.#type = "bytes";
        if (this.#exceedsLimit(limit)) {
          return () =>
            Promise.reject(new RangeError(`Body exceeds a limit of ${limit}.`));
        }
        return async () =>
          JSON.parse(
            decoder.decode(await this.#valuePromise()),
            this.#jsonBodyReviver,
          );
      case "bytes":
        this.#type = "bytes";
        if (this.#exceedsLimit(limit)) {
          return () =>
            Promise.reject(new RangeError(`Body exceeds a limit of ${limit}.`));
        }
        return () => this.#valuePromise();
      case "text":
        this.#type = "bytes";
        if (this.#exceedsLimit(limit)) {
          return () =>
            Promise.reject(new RangeError(`Body exceeds a limit of ${limit}.`));
        }
        return async () => decoder.decode(await this.#valuePromise());
      default:
        throw new TypeError(`Invalid body type: "${type}"`);
    }
  }

  #validateGetArgs(
    type: BodyType | undefined,
    contentTypes: BodyOptionsContentTypes,
  ) {
    if (type === "reader" && this.#type && this.#type !== "reader") {
      throw new TypeError(
        `Body already consumed as "${this.#type}" and cannot be returned as a reader.`,
      );
    }
    if (type === "stream" && this.#type && this.#type !== "stream") {
      throw new TypeError(
        `Body already consumed as "${this.#type}" and cannot be returned as a stream.`,
      );
    }
    if (type === "form-data" && this.#type && this.#type !== "form-data") {
      throw new TypeError(
        `Body already consumed as "${this.#type}" and cannot be returned as a stream.`,
      );
    }
    if (this.#type === "reader" && type !== "reader") {
      throw new TypeError(
        "Body already consumed as a reader and can only be returned as a reader.",
      );
    }
    if (this.#type === "stream" && type !== "stream") {
      throw new TypeError(
        "Body already consumed as a stream and can only be returned as a stream.",
      );
    }
    if (this.#type === "form-data" && type !== "form-data") {
      throw new TypeError(
        "Body already consumed as form data and can only be returned as form data.",
      );
    }
    if (type && Object.keys(contentTypes).length) {
      throw new TypeError(
        `"type" and "contentTypes" cannot be specified at the same time`,
      );
    }
  }

  #valuePromise() {
    return this.#readAllBody ?? (this.#readAllBody = this.#readBody());
  }

  constructor(
    { body, readBody }: ServerRequestBody,
    headers: Headers,
    jsonBodyReviver?: (key: string, value: unknown) => unknown,
  ) {
    this.#body = body;
    this.#headers = headers;
    this.#jsonBodyReviver = jsonBodyReviver;
    this.#readBody = readBody;
  }

  get(
    { limit = DEFAULT_LIMIT, type, contentTypes = {} }: BodyOptions = {},
  ): Body | BodyReader | BodyStream {
    this.#validateGetArgs(type, contentTypes);
    if (type === "reader") {
      if (!this.#body) {
        this.#type = "undefined";
        throw new TypeError(
          `Body is undefined and cannot be returned as "reader".`,
        );
      }
      this.#type = "reader";
      return {
        type,
        value: readerFromStreamReader(this.#body.getReader()),
      };
    }
    if (type === "stream") {
      if (!this.#body) {
        this.#type = "undefined";
        throw new TypeError(
          `Body is undefined and cannot be returned as "stream".`,
        );
      }
      this.#type = "stream";
      const streams =
        ((this.#stream ?? this.#body) as ReadableStream<Uint8Array>)
          .tee();
      this.#stream = streams[1];
      return { type, value: streams[0] };
    }
    if (!this.has()) {
      this.#type = "undefined";
    } else if (!this.#type) {
      const encoding = this.#headers.get("content-encoding") ??
        "identity";
      if (encoding !== "identity") {
        throw new errors.UnsupportedMediaType(
          `Unsupported content-encoding: ${encoding}`,
        );
      }
    }
    if (this.#type === "undefined" && (!type || type === "undefined")) {
      return { type: "undefined", value: undefined };
    }
    if (!type) {
      const contentType = this.#headers.get("content-type");
      assert(
        contentType,
        "The Content-Type header is missing from the request",
      );
      type = resolveType(contentType, contentTypes);
    }
    assert(type);
    const body: Body = Object.create(null);
    Object.defineProperties(body, {
      type: {
        value: type,
        configurable: true,
        enumerable: true,
      },
      value: {
        get: this.#parse(type, limit),
        configurable: true,
        enumerable: true,
      },
    });
    return body;
  }

  /** Returns if the request might have a body or not, without attempting to
   * consume it.
   *
   * **WARNING** This is an unreliable API. In HTTP/2 it is not possible to
   * determine if certain HTTP methods have a body or not without attempting to
   * read the body. As of Deno 1.16.1 and later, for HTTP/1.1 aligns to the
   * HTTP/2 behaviour.
   */
  has(): boolean {
    return this.#body != null;
  }
}
