// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

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
import { accepts, acceptsEncodings, acceptsLanguages } from "./deps.ts";
import type { HTTPMethods, ServerRequest } from "./types.d.ts";

export interface OakRequestOptions {
  jsonBodyReviver?: (key: string, value: unknown) => unknown;
  proxy?: boolean;
  secure?: boolean;
}

/** An interface which provides information about the current request. The
 * instance related to the current request is available on the
 * {@linkcode Context}'s `.request` property.
 *
 * The interface contains several properties to get information about the
 * request as well as several methods, which include content negotiation and
 * the ability to decode a request body.
 */
export class Request {
  #body: RequestBody;
  #proxy: boolean;
  #secure: boolean;
  #serverRequest: ServerRequest;
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
  get originalRequest(): ServerRequest {
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
          if (serverRequest.rawUrl) {
            this.#url = new URL(serverRequest.rawUrl);
            return this.#url;
          }
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
    serverRequest: ServerRequest,
    { proxy = false, secure = false, jsonBodyReviver }: OakRequestOptions = {},
  ) {
    this.#proxy = proxy;
    this.#secure = secure;
    this.#serverRequest = serverRequest;
    this.#body = new RequestBody(
      serverRequest.getBody(),
      serverRequest.headers,
      jsonBodyReviver,
    );
  }

  /** Returns an array of media types, accepted by the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * then accepting any is implied is returned.
   */
  accepts(): string[] | undefined;
  /** For a given set of media types, return the best match accepted by the
   * requestor.  If there are no encoding that match, then the method returns
   * `undefined`.
   */
  accepts(...types: string[]): string | undefined;
  accepts(...types: string[]): string | string[] | undefined {
    if (!this.#serverRequest.headers.has("Accept")) {
      return types.length ? types[0] : ["*/*"];
    }
    if (types.length) {
      return accepts(this.#serverRequest, ...types);
    }
    return accepts(this.#serverRequest);
  }

  /** Returns an array of encodings, accepted by the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * then `["*"]` is returned, matching any.
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
    if (!this.#serverRequest.headers.has("Accept-Encoding")) {
      return encodings.length ? encodings[0] : ["*"];
    }
    if (encodings.length) {
      return acceptsEncodings(this.#serverRequest, ...encodings);
    }
    return acceptsEncodings(this.#serverRequest);
  }

  /** Returns an array of languages, accepted by the requestor, in order of
   * preference.  If there are no languages supplied by the requestor,
   * `["*"]` is returned, indicating any language is accepted.
   */
  acceptsLanguages(): string[] | undefined;
  /** For a given set of languages, return the best match accepted by the
   * requestor.  If there are no languages that match, then the method returns
   * `undefined`. */
  acceptsLanguages(...langs: string[]): string | undefined;
  acceptsLanguages(...langs: string[]): string[] | string | undefined {
    if (!this.#serverRequest.headers.get("Accept-Language")) {
      return langs.length ? langs[0] : ["*"];
    }
    if (langs.length) {
      return acceptsLanguages(this.#serverRequest, ...langs);
    }
    return acceptsLanguages(this.#serverRequest);
  }

  body(options: BodyOptions<"bytes">): BodyBytes;
  body(options: BodyOptions<"form">): BodyForm;
  body(options: BodyOptions<"form-data">): BodyFormData;
  body(options: BodyOptions<"json">): BodyJson;
  body(options: BodyOptions<"reader">): BodyReader;
  body(options: BodyOptions<"stream">): BodyStream;
  body(options: BodyOptions<"text">): BodyText;
  body(options?: BodyOptions): Body;
  /** Access the body of the request. This is a method, because there are
   * several options which can be provided which can influence how the body is
   * handled. */
  body(options: BodyOptions = {}): Body | BodyReader | BodyStream {
    return this.#body.get(options);
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    const { hasBody, headers, ip, ips, method, secure, url } = this;
    return `${this.constructor.name} ${
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

  [Symbol.for("nodejs.util.inspect.custom")](
    depth: number,
    // deno-lint-ignore no-explicit-any
    options: any,
    inspect: (value: unknown, options?: unknown) => string,
  ) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }

    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1,
    });
    const { hasBody, headers, ip, ips, method, secure, url } = this;
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect(
        { hasBody, headers, ip, ips, method, secure, url },
        newOptions,
      )
    }`;
  }
}
