// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { ServerRequest } from "./deps.ts";
import { preferredEncodings } from "./encoding.ts";
import httpErrors from "./httpError.ts";
import { isMediaType } from "./isMediaType.ts";
import { preferredMediaTypes } from "./mediaType.ts";
import { HTTPMethods } from "./types.ts";

export type BodyType =
  | "json"
  | "form"
  | "text"
  | "raw"
  | "undefined"
  | "reader";

export type BodyJson = { type: "json"; value: any };
export type BodyForm = { type: "form"; value: URLSearchParams };
export type BodyText = { type: "text"; value: string };
export type BodyRaw = { type: "raw"; value: Uint8Array };
export type BodyUndefined = { type: "undefined"; value: undefined };

export type BodyReader = { type: "reader"; value: Deno.Reader };

export type Body =
  | BodyJson
  | BodyForm
  | BodyText
  | BodyRaw
  | BodyUndefined;

const decoder = new TextDecoder();

export interface BodyContentTypes {
  json?: string[];
  form?: string[];
  text?: string[];
}

const defaultBodyContentTypes = {
  json: ["json", "application/*+json", "application/csp-report"],
  form: ["urlencoded"],
  text: ["text"],
};

export class Request {
  #body?: Body | BodyReader;
  #contentTypes: Required<BodyContentTypes>;
  #rawBodyPromise?: Promise<Uint8Array>;
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

  /** The HTTP Method used by the request. */
  get method(): HTTPMethods {
    return this.#serverRequest.method as HTTPMethods;
  }

  /** Shortcut to `request.url.protocol === "https"`. */
  get secure(): boolean {
    console.log("this.url.protocol", this.url.protocol);
    return this.url.protocol === "https:";
  }

  /** Returns the _original_ Deno server request. */
  get serverRequest(): ServerRequest {
    return this.#serverRequest;
  }

  /** A WHATWG parsed URL. */
  get url(): URL {
    if (!this.#url) {
      const serverRequest = this.#serverRequest;
      const proto = serverRequest.proto.split("/")[0].toLowerCase();
      this.#url = new URL(
        `${proto}://${serverRequest.headers.get("host")}${serverRequest.url}`,
      );
    }
    return this.#url;
  }

  constructor(
    serverRequest: ServerRequest,
    bodyContentTypes: BodyContentTypes = {},
  ) {
    this.#serverRequest = serverRequest;
    this.#contentTypes = {
      json: [...defaultBodyContentTypes.json],
      form: [...defaultBodyContentTypes.form],
      text: [...defaultBodyContentTypes.text],
    };
    if (bodyContentTypes.json) {
      this.#contentTypes.json.push(...bodyContentTypes.json);
    }
    if (bodyContentTypes.form) {
      this.#contentTypes.form.push(...bodyContentTypes.form);
    }
    if (bodyContentTypes.text) {
      this.#contentTypes.text.push(...bodyContentTypes.text);
    }
  }

  /** Returns an array of media types, accepted by the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * `undefined` is returned.
   */
  accepts(): string[];
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

  acceptsCharsets(): string[];
  acceptsCharsets(...charsets: string[]): string | undefined;
  acceptsCharsets(...charsets: string[]): string[] | string | undefined {
    return undefined;
  }

  /** Returns an array of encodings, accepted the the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * `undefined` is returned.
   */
  acceptsEncodings(): string[];
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

  acceptsLanguages(): string[];
  acceptsLanguages(...langs: string[]): string | undefined;
  acceptsLanguages(...langs: string[]): string[] | string | undefined {
    return undefined;
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
  async body(asDenoReader: true): Promise<BodyReader>;
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
  async body(): Promise<Body>;
  async body(asDenoReader = false): Promise<Body | BodyReader> {
    if (this.#body) {
      if (asDenoReader && this.#body.type !== "reader") {
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
      if (asDenoReader) {
        return (this.#body = {
          type: "reader",
          value: this.#serverRequest.body,
        });
      }
      const rawBody = await (this.#rawBodyPromise ??
        (this.#rawBodyPromise = Deno.readAll(this.#serverRequest.body)));
      const value = decoder.decode(rawBody);
      const contentTypes = this.#contentTypes;
      if (isMediaType(contentType, contentTypes.json)) {
        return (this.#body = { type: "json", value: JSON.parse(value) });
      } else if (isMediaType(contentType, contentTypes.form)) {
        return (this.#body = {
          type: "form",
          value: new URLSearchParams(value.replace(/\+/g, " ")),
        });
      } else if (isMediaType(contentType, contentTypes.text)) {
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
