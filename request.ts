// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { ServerRequest } from "./deps.ts";
import { preferredEncodings } from "./encoding.ts";
import httpErrors from "./httpError.ts";
import { isMediaType } from "./isMediaType.ts";
import { preferredMediaTypes } from "./mediaType.ts";
import { HTTPMethods } from "./types.ts";

export enum BodyType {
  JSON = "json",
  Form = "form",
  Text = "text",
  Undefined = "undefined",
}

export type Body =
  | { type: BodyType.JSON; value: any }
  | { type: BodyType.Form; value: URLSearchParams }
  | { type: BodyType.Text; value: string }
  | { type: BodyType.Undefined; value: undefined };

const decoder = new TextDecoder();

const jsonTypes = ["json", "application/*+json", "application/csp-report"];
const formTypes = ["urlencoded"];
const textTypes = ["text"];

export class Request {
  #body?: Body;
  #path: string;
  #rawBodyPromise?: Promise<Uint8Array>;
  #search?: string;
  #searchParams: URLSearchParams;
  #serverRequest: ServerRequest;

  /** Is `true` if the request has a body, otherwise `false`. */
  get hasBody(): boolean {
    return (
      this.headers.get("transfer-encoding") !== null ||
      !!parseInt(this.headers.get("content-length") || "")
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

  /** The path of the request. */
  get path(): string {
    return this.#path;
  }

  /** The search part of the URL of the request. */
  get search(): string | undefined {
    return this.#search;
  }

  /** The parsed `URLSearchParams` of the request. */
  get searchParams(): URLSearchParams {
    return this.#searchParams;
  }

  /** Returns the _original_ Deno server request. */
  get serverRequest(): ServerRequest {
    return this.#serverRequest;
  }

  /** The URL of the request. */
  get url(): string {
    return this.#serverRequest.url;
  }

  constructor(serverRequest: ServerRequest) {
    this.#serverRequest = serverRequest;
    const [path, search] = serverRequest.url.split("?");
    this.#path = path;
    this.#search = search ? `?${search}` : undefined;
    this.#searchParams = new URLSearchParams(search);
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
   */
  async body(): Promise<Body> {
    if (this.#body) {
      return this.#body;
    }
    const encoding = this.headers.get("content-encoding") || "identity";
    if (encoding !== "identity") {
      throw new httpErrors.UnsupportedMediaType(
        `Unsupported content-encoding: ${encoding}`,
      );
    }
    if (!this.hasBody) {
      return { type: BodyType.Undefined, value: undefined };
    }
    const contentType = this.headers.get("content-type");
    if (contentType) {
      const rawBody = await (this.#rawBodyPromise ||
        (this.#rawBodyPromise = Deno.readAll(this.#serverRequest.body)));
      const str = decoder.decode(rawBody);
      if (isMediaType(contentType, jsonTypes)) {
        return (this.#body = { type: BodyType.JSON, value: JSON.parse(str) });
      } else if (isMediaType(contentType, formTypes)) {
        return (this.#body = {
          type: BodyType.Form,
          value: new URLSearchParams(str.replace(/\+/g, " ")),
        });
      } else if (isMediaType(contentType, textTypes)) {
        return (this.#body = { type: BodyType.Text, value: str });
      }
    }
    throw new httpErrors.UnsupportedMediaType(
      contentType
        ? `Unsupported content-type: ${contentType}`
        : "Missing content-type",
    );
  }
}
