// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import { assert, Buffer, readAll, readerFromStreamReader } from "./deps.ts";
import type { ServerRequest } from "./http_server_std.ts";
import { httpErrors } from "./httpError.ts";
import { isMediaType } from "./isMediaType.ts";
import { FormDataReader } from "./multipart.ts";
import { readableStreamFromReader } from "./util.ts";

export type BodyType =
  | "bytes"
  | "form"
  | "form-data"
  | "json"
  | "text"
  | "reader"
  | "stream"
  | "undefined";

export type BodyBytes = {
  readonly type: "bytes";
  readonly value: Promise<Uint8Array>;
};
// deno-lint-ignore no-explicit-any
export type BodyJson = { readonly type: "json"; readonly value: Promise<any> };
export type BodyForm = {
  readonly type: "form";
  readonly value: Promise<URLSearchParams>;
};
export type BodyFormData = {
  readonly type: "form-data";
  readonly value: FormDataReader;
};
export type BodyText = {
  readonly type: "text";
  readonly value: Promise<string>;
};
export type BodyUndefined = {
  readonly type: "undefined";
  readonly value: undefined;
};

export type BodyReader = {
  readonly type: "reader";
  readonly value: Deno.Reader;
};
export type BodyStream = {
  readonly type: "stream";
  readonly value: ReadableStream<Uint8Array>;
};

export type Body =
  | BodyBytes
  | BodyJson
  | BodyForm
  | BodyFormData
  | BodyText
  | BodyUndefined;

type BodyValueGetter = () => Body["value"];

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

export interface BodyOptions<T extends BodyType = BodyType> {
  /** Instead of utilizing the content type of the request, attempt to parse the
   * body as the type specified. */
  type?: T;
  /** A map of extra content types to determine how to parse the body. */
  contentTypes?: BodyOptionsContentTypes;
}

export interface BodyContentTypes {
  json?: string[];
  form?: string[];
  text?: string[];
}

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

function bodyAsReader(
  body: ReadableStream<Uint8Array> | Deno.Reader | null,
): Deno.Reader {
  return body instanceof ReadableStream
    ? readerFromStreamReader(body.getReader())
    : body ?? new Buffer();
}

function bodyAsStream(
  body: Deno.Reader | ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  return body instanceof ReadableStream ? body : readableStreamFromReader(body);
}

export class RequestBody {
  #formDataReader?: FormDataReader;
  #stream?: ReadableStream<Uint8Array>;
  #has?: boolean;
  #readAllBody?: Promise<Uint8Array>;
  #request: Request | ServerRequest;
  #type?: "bytes" | "form-data" | "reader" | "stream" | "undefined";

  #parse(type: BodyType): BodyValueGetter {
    switch (type) {
      case "form":
        this.#type = "bytes";
        return async () =>
          new URLSearchParams(
            decoder.decode(await this.#valuePromise()).replace(/\+/g, " "),
          );
      case "form-data":
        this.#type = "form-data";
        return () => {
          const contentType = this.#request.headers.get("content-type");
          assert(contentType);
          return this.#formDataReader ??
            (this.#formDataReader = new FormDataReader(
              contentType,
              bodyAsReader(this.#request.body),
            ));
        };
      case "json":
        this.#type = "bytes";
        return async () =>
          JSON.parse(decoder.decode(await this.#valuePromise()));
      case "bytes":
        this.#type = "bytes";
        return () => this.#valuePromise();
      case "text":
        this.#type = "bytes";
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
    return this.#readAllBody ??
      (this.#readAllBody = this.#request instanceof Request
        ? this.#request.arrayBuffer().then((ab) => new Uint8Array(ab))
        : readAll(this.#request.body));
  }

  constructor(request: ServerRequest | Request) {
    this.#request = request;
  }

  get(
    { type, contentTypes = {} }: BodyOptions,
  ): Body | BodyReader | BodyStream {
    this.#validateGetArgs(type, contentTypes);
    if (type === "reader") {
      this.#type = "reader";
      return { type, value: bodyAsReader(this.#request.body) };
    }
    if (type === "stream") {
      if (!this.#request.body) {
        this.#type = "undefined";
        throw new TypeError(
          `Body is undefined and cannot be returned as "stream".`,
        );
      }
      this.#type = "stream";
      const streams = (this.#stream ?? bodyAsStream(this.#request.body)).tee();
      this.#stream = streams[1];
      return { type, value: streams[0] };
    }
    if (!this.has()) {
      this.#type = "undefined";
    } else if (!this.#type) {
      const encoding = this.#request.headers.get("content-encoding") ??
        "identity";
      if (encoding !== "identity") {
        throw new httpErrors.UnsupportedMediaType(
          `Unsupported content-encoding: ${encoding}`,
        );
      }
    }
    if (this.#type === "undefined") {
      if (type && type !== "undefined") {
        throw new TypeError(
          `Body is undefined and cannot be returned as "${type}".`,
        );
      }
      return { type: "undefined", value: undefined };
    }
    if (!type) {
      const contentType = this.#request.headers.get("content-type");
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
        get: this.#parse(type),
        configurable: true,
        enumerable: true,
      },
    });
    return body;
  }

  /** Returns if the request's has a body or not, without attempting to consume
   * the body. */
  has(): boolean {
    return this.#has !== undefined
      ? this.#has
      : (this.#has = this.#request.body != null &&
          (this.#request.headers.has("transfer-encoding") ||
            !!parseInt(
              this.#request.headers.get("content-length") ?? "",
              10,
            )) || this.#request.body instanceof ReadableStream);
  }
}
