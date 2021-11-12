// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type {
  Body,
  BodyBytes,
  BodyForm,
  BodyFormData,
  BodyJson,
  BodyOptions,
  BodyReader,
  BodyStream,
  BodyText,
} from "./body.ts";
import { RequestBody } from "./body.ts";
import type { NativeRequest } from "./http_server_native.ts";
import type { HTTPMethods } from "./types.d.ts";
import { preferredCharsets } from "./negotiation/charset.ts";
import { preferredEncodings } from "./negotiation/encoding.ts";
import { preferredLanguages } from "./negotiation/language.ts";
import { preferredMediaTypes } from "./negotiation/mediaType.ts";

/** An interface which provides information about the current request. */
export class Request {
  #body: RequestBody;
  #proxy: boolean;
  #secure: boolean;
  #serverRequest: NativeRequest;
  #url?: URL;

  #getRemoteAddr(): string {
    return this.#serverRequest.remoteAddr ?? "";
  }

  /** Is `true` if the request might have a body, otherwise `false`.
   *
   * **WARNING** this is an unreliable API. In HTTP/2 in many situations you
   * cannot determine if a request has a body or not unless you attempt to read
   * the body, due to the streaming nature of HTTP/2. As of Deno 1.16.1, for
   * HTTP/1.1, Deno also reflects that behaviour.  The only reliable way to
   * determine if a request has a body or not is to attempt to read the body.
   */
  get hasBody(): boolean {
    return this.#body.has();
  }

  /** The `Headers` supplied in the request. */
  get headers(): Headers {
    return this.#serverRequest.headers;
  }

  /** Request remote address. When the application's `.proxy` is true, the
   * `X-Forwarded-For` will be used to determine the requesting remote address.
   */
  get ip(): string {
    return (this.#proxy ? this.ips[0] : this.#getRemoteAddr()) ?? "";
  }

  /** When the application's `.proxy` is `true`, this will be set to an array of
   * IPs, ordered from upstream to downstream, based on the value of the header
   * `X-Forwarded-For`.  When `false` an empty array is returned. */
  get ips(): string[] {
    return this.#proxy
      ? (this.#serverRequest.headers.get("x-forwarded-for") ??
        this.#getRemoteAddr()).split(/\s*,\s*/)
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
  get originalRequest(): NativeRequest {
    return this.#serverRequest;
  }

  /** A parsed URL for the request which complies with the browser standards.
   * When the application's `.proxy` is `true`, this value will be based off of
   * the `X-Forwarded-Proto` and `X-Forwarded-Host` header values if present in
   * the request. */
  get url(): URL {
    if (!this.#url) {
      const serverRequest = this.#serverRequest;
      if (!this.#proxy) {
        // between 1.9.0 and 1.9.1 the request.url of the native HTTP started
        // returning the full URL, where previously it only returned the path
        // so we will try to use that URL here, but default back to old logic
        // if the URL isn't valid.
        try {
          this.#url = new URL(serverRequest.rawUrl);
          return this.#url;
        } catch {
          // we don't care about errors here
        }
      }
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
      try {
        this.#url = new URL(`${proto}://${host}${serverRequest.url}`);
      } catch {
        throw new TypeError(
          `The server request URL of "${proto}://${host}${serverRequest.url}" is invalid.`,
        );
      }
    }
    return this.#url;
  }

  constructor(
    serverRequest: NativeRequest,
    proxy = false,
    secure = false,
  ) {
    this.#proxy = proxy;
    this.#secure = secure;
    this.#serverRequest = serverRequest;
    this.#body = new RequestBody(serverRequest.request);
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

  body(options: BodyOptions<"bytes">): BodyBytes;
  body(options: BodyOptions<"form">): BodyForm;
  body(options: BodyOptions<"form-data">): BodyFormData;
  body(options: BodyOptions<"json">): BodyJson;
  body(options: BodyOptions<"reader">): BodyReader;
  body(options: BodyOptions<"stream">): BodyStream;
  body(options: BodyOptions<"text">): BodyText;
  body(options?: BodyOptions): Body;
  body(options: BodyOptions = {}): Body | BodyReader | BodyStream {
    return this.#body.get(options);
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    const { hasBody, headers, ip, ips, method, secure, url } = this;
    return `Request ${
      inspect({
        hasBody,
        headers,
        ip,
        ips,
        method,
        secure,
        url: url.toString(),
      })
    }`;
  }
}
