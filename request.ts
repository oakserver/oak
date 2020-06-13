// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { ServerRequest } from "./deps.ts";
import { httpErrors } from "./httpError.ts";
import { isMediaType } from "./isMediaType.ts";
import { FormDataReader } from "./multipart.ts";
import { HTTPMethods } from "./types.d.ts";
import { preferredCharsets } from "./negotiation/charset.ts";
import { preferredEncodings } from "./negotiation/encoding.ts";
import { preferredLanguages } from "./negotiation/language.ts";
import { preferredMediaTypes } from "./negotiation/mediaType.ts";

export type BodyType =
  | "json"
  | "form"
  | "form-data"
  | "text"
  | "raw"
  | "undefined"
  | "reader";

export type BodyJson = { type: "json"; value: any };
export type BodyForm = { type: "form"; value: URLSearchParams };
export type BodyFormData = { type: "form-data"; value: FormDataReader };
export type BodyText = { type: "text"; value: string };
export type BodyRaw = { type: "raw"; value: Uint8Array };
export type BodyUndefined = { type: "undefined"; value: undefined };

export type BodyReader = { type: "reader"; value: Deno.Reader };

export type Body =
  | BodyJson
  | BodyForm
  | BodyFormData
  | BodyText
  | BodyRaw
  | BodyUndefined;

export interface BodyOptions {
  /** If `true`, return a body value of `Deno.Reader`. */
  asReader?: boolean;

  /** A map of extra content types to determine how to parse the body. */
  contentTypes?: {
    /** Content types listed here will always return a "raw" Uint8Array. */
    raw?: string[];
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
  };
}

export interface BodyOptionsAsReader extends BodyOptions {
  /** If `true`, return a body value of `Deno.Reader`. */
  asReader: true;
}

const decoder = new TextDecoder();

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

/** An interface which provides information about the current request. */
export class Request {
  #body?: Body | BodyReader;
  #proxy: boolean;
  #rawBodyPromise?: Promise<Uint8Array>;
  #secure: boolean;
  #serverRequest: ServerRequest;
  #url?: URL;

  /** Is `true` if the request has a body, otherwise `false`. */
  get hasBody(): boolean {
    return (
      this.headers.get("transfer-encoding") !== null ||
      !!parseInt(this.headers.get("content-length") ?? "")
    );
  }

  /** The `Headers` supplied in the request. */
  get headers(): Headers {
    return this.#serverRequest.headers;
  }

  /** Request remote address. When the application's `.proxy` is true, the
   * `X-Forwarded-For` will be used to determine the requesting remote address.
   */
  get ip(): string {
    return this.#proxy
      ? this.ips[0]
      : (this.#serverRequest.conn.remoteAddr as Deno.NetAddr).hostname;
  }

  /** When the application's `.proxy` is `true`, this will be set to an array of
   * IPs, ordered from upstream to downstream, based on the value of the header 
   * `X-Forwarded-For`.  When `false` an empty array is returned. */
  get ips(): string[] {
    return this.#proxy
      ? (this.#serverRequest.headers.get("x-forwarded-for") ??
        (this.#serverRequest.conn.remoteAddr as Deno.NetAddr).hostname).split(
          /\s*,\s*/,
        )
      : [];
  }

  /** The HTTP Method used by the request. */
  get method(): HTTPMethods {
    return this.#serverRequest.method as HTTPMethods;
  }

  /** Shortcut to `request.url.protocol === "https:"`. */
  get secure(): boolean {
    return this.#secure;
  }

  /** Set to the value of the _original_ Deno server request. */
  get serverRequest(): ServerRequest {
    return this.#serverRequest;
  }

  /** A parsed URL for the request which complies with the browser standards.
   * When the application's `.proxy` is `true`, this value will be based off of
   * the `X-Forwarded-Proto` and `X-Forwarded-Host` header values if present in
   * the request. */
  get url(): URL {
    if (!this.#url) {
      const serverRequest = this.#serverRequest;
      let proto: string;
      let host: string;
      if (this.#proxy) {
        proto = serverRequest
          .headers.get("x-forwarded-proto")?.split(/\s*,\s*/, 1)[0] ??
          "http";
        host = serverRequest.headers.get("x-forwarded-host") ??
          serverRequest.headers.get("host") ?? "";
      } else {
        proto = this.#secure ? "https" : "http";
        host = serverRequest.headers.get("host") ?? "";
      }
      this.#url = new URL(`${proto}://${host}${serverRequest.url}`);
    }
    return this.#url;
  }

  constructor(serverRequest: ServerRequest, proxy = false, secure = false) {
    this.#proxy = proxy;
    this.#secure = secure;
    this.#serverRequest = serverRequest;
  }

  /** Returns an array of media types, accepted by the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * `undefined` is returned.
   */
  accepts(): string[] | undefined;
  /** For a given set of media types, return the best match accepted by the
   * requestor.  If there are no encoding that match, then the method returns
   * `undefined`.
   */
  accepts(...types: string[]): string | undefined;
  accepts(...types: string[]): string | string[] | undefined {
    const acceptValue = this.#serverRequest.headers.get("Accept");
    if (!acceptValue) {
      return;
    }
    if (types.length) {
      return preferredMediaTypes(acceptValue, types)[0];
    }
    return preferredMediaTypes(acceptValue);
  }

  /** Returns an array of charsets, accepted by the requestor, in order of
   * preference.  If there are no charsets supplied by the requestor,
   * `undefined` is returned.
   */
  acceptsCharsets(): string[] | undefined;
  /** For a given set of charsets, return the best match accepted by the
   * requestor.  If there are no charsets that match, then the method returns
   * `undefined`. */
  acceptsCharsets(...charsets: string[]): string | undefined;
  acceptsCharsets(...charsets: string[]): string[] | string | undefined {
    const acceptCharsetValue = this.#serverRequest.headers.get(
      "Accept-Charset",
    );
    if (!acceptCharsetValue) {
      return;
    }
    if (charsets.length) {
      return preferredCharsets(acceptCharsetValue, charsets)[0];
    }
    return preferredCharsets(acceptCharsetValue);
  }

  /** Returns an array of encodings, accepted by the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * `undefined` is returned.
   */
  acceptsEncodings(): string[] | undefined;
  /** For a given set of encodings, return the best match accepted by the
   * requestor.  If there are no encodings that match, then the method returns
   * `undefined`.
   *
   * **NOTE:** You should always supply `identity` as one of the encodings
   * to ensure that there is a match when the `Accept-Encoding` header is part
   * of the request.
   */
  acceptsEncodings(...encodings: string[]): string | undefined;
  acceptsEncodings(...encodings: string[]): string[] | string | undefined {
    const acceptEncodingValue = this.#serverRequest.headers.get(
      "Accept-Encoding",
    );
    if (!acceptEncodingValue) {
      return;
    }
    if (encodings.length) {
      return preferredEncodings(acceptEncodingValue, encodings)[0];
    }
    return preferredEncodings(acceptEncodingValue);
  }

  /** Returns an array of languages, accepted by the requestor, in order of
   * preference.  If there are no languages supplied by the requestor,
   * `undefined` is returned.
   */
  acceptsLanguages(): string[] | undefined;
  /** For a given set of languages, return the best match accepted by the
   * requestor.  If there are no languages that match, then the method returns
   * `undefined`. */
  acceptsLanguages(...langs: string[]): string | undefined;
  acceptsLanguages(...langs: string[]): string[] | string | undefined {
    const acceptLanguageValue = this.#serverRequest.headers.get(
      "Accept-Language",
    );
    if (!acceptLanguageValue) {
      return;
    }
    if (langs.length) {
      return preferredLanguages(acceptLanguageValue, langs)[0];
    }
    return preferredLanguages(acceptLanguageValue);
  }

  /** If there is a body in the request, resolves with an object which
   * describes the body.  The `type` provides what type the body is and `body`
   * provides the actual body.
   * 
   * If you need access to the "raw" interface for the body, pass `true` as the
   * first argument and the method will resolve if the `Deno.Reader`.
   * 
   *       app.use(async (ctx) => {
   *         const result = await ctx.request.body(true);
   *         const body = await Deno.readAll(result.body);
   *       });
   * 
   */
  async body(options: BodyOptionsAsReader): Promise<BodyReader>;
  /** If there is a body in the request, resolves with an object which
   * describes the body.  The `type` provides what type the body is and `body`
   * provides the actual body.
   * 
   * If you need access to the "raw" interface for the body, pass `true` as the
   * first argument and the method will resolve if the `Deno.Reader`.
   * 
   *       app.use(async (ctx) => {
   *         const result = await ctx.request.body(true);
   *         const body = await Deno.readAll(result.body);
   *       });
   * 
   */
  async body(options?: BodyOptions): Promise<Body>;
  async body(
    { asReader, contentTypes = {} }: BodyOptions = {},
  ): Promise<Body | BodyReader> {
    if (this.#body) {
      if (asReader && this.#body.type !== "reader") {
        return Promise.reject(
          new TypeError(`Body already consumed as type: "${this.#body.type}".`),
        );
      } else if (this.#body.type === "reader") {
        return Promise.reject(
          new TypeError(`Body already consumed as type: "reader".`),
        );
      }
      return this.#body;
    }
    const encoding = this.headers.get("content-encoding") || "identity";
    if (encoding !== "identity") {
      throw new httpErrors.UnsupportedMediaType(
        `Unsupported content-encoding: ${encoding}`,
      );
    }
    if (!this.hasBody) {
      return (this.#body = { type: "undefined", value: undefined });
    }
    const contentType = this.headers.get("content-type");
    if (contentType) {
      if (asReader) {
        return (this.#body = {
          type: "reader",
          value: this.#serverRequest.body,
        });
      }
      const contentTypesFormData = [
        ...defaultBodyContentTypes.formData,
        ...(contentTypes.formData ?? []),
      ];
      if (isMediaType(contentType, contentTypesFormData)) {
        return (this.#body = {
          type: "form-data",
          value: new FormDataReader(contentType, this.#serverRequest.body),
        });
      }
      const rawBody = await (this.#rawBodyPromise ??
        (this.#rawBodyPromise = Deno.readAll(this.#serverRequest.body)));
      const value = decoder.decode(rawBody);
      const contentTypesRaw = contentTypes.raw;
      const contentTypesJson = [
        ...defaultBodyContentTypes.json,
        ...(contentTypes.json ?? []),
      ];
      const contentTypesForm = [
        ...defaultBodyContentTypes.form,
        ...(contentTypes.form ?? []),
      ];
      const contentTypesText = [
        ...defaultBodyContentTypes.text,
        ...(contentTypes.text ?? []),
      ];
      console.log("contentType", contentType);
      if (contentTypesRaw && isMediaType(contentType, contentTypesRaw)) {
        return (this.#body = { type: "raw", value: rawBody });
      } else if (isMediaType(contentType, contentTypesJson)) {
        return (this.#body = { type: "json", value: JSON.parse(value) });
      } else if (isMediaType(contentType, contentTypesForm)) {
        return (this.#body = {
          type: "form",
          value: new URLSearchParams(value.replace(/\+/g, " ")),
        });
      } else if (isMediaType(contentType, contentTypesText)) {
        return (this.#body = { type: "text", value });
      } else {
        return (this.#body = { type: "raw", value: rawBody });
      }
    }
    throw new httpErrors.UnsupportedMediaType(
      contentType
        ? `Unsupported content-type: ${contentType}`
        : "Missing content-type",
    );
  }
}
