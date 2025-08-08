// Copyright 2018-2025 the oak authors. All rights reserved. MIT license.

/**
 * Contains the {@linkcode Request} abstraction used by oak.
 *
 * Most end users would not need to directly access this module.
 *
 * @module
 */

import { Body } from "./body.ts";
import { ServerSentEventStreamTarget } from "./deps.ts";
import {
  accepts,
  acceptsEncodings,
  acceptsLanguages,
  type HTTPMethods,
  type ServerSentEventTarget,
  type ServerSentEventTargetOptions,
  UserAgent,
} from "./deps.ts";
import type { ServerRequest, UpgradeWebSocketOptions } from "./types.ts";

interface OakRequestOptions {
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
  #body: Body;
  #proxy: boolean;
  #secure: boolean;
  #serverRequest: ServerRequest;
  #url?: URL;
  #userAgent: UserAgent;

  #getRemoteAddr(): string {
    return this.#serverRequest.remoteAddr ?? "";
  }

  /** An interface to access the body of the request. This provides an API that
   * aligned to the **Fetch Request** API, but in a dedicated API.
   */
  get body(): Body {
    return this.#body;
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
    return this.#body.has;
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
      ? (() => {
          const raw = this.#serverRequest.headers.get("x-forwarded-for") ?? this.#getRemoteAddr();
          const bounded = raw.length > 4096 ? raw.slice(0, 4096) : raw;
          return bounded
            .split(",", 100)
            .map((part) => part.trim())
            .filter((part) => part.length > 0);
        })()
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

  /** Set to the value of the low level oak server request abstraction.
   *
   * @deprecated this will be removed in future versions of oak. Accessing this
   * abstraction is not useful to end users and is now a bit of a misnomer.
   */
  get originalRequest(): ServerRequest {
    return this.#serverRequest;
  }

  /** Returns the original Fetch API `Request` if available.
   *
   * This should be set with requests on Deno, but will not be set when running
   * on Node.js.
   */
  get source(): globalThis.Request | undefined {
    return this.#serverRequest.request;
  }

  /** A parsed URL for the request which complies with the browser standards.
   * When the application's `.proxy` is `true`, this value will be based off of
   * the `X-Forwarded-Proto` and `X-Forwarded-Host` header values if present in
   * the request. */
  get url(): URL {
    if (!this.#url) {
      const serverRequest = this.#serverRequest;
      // between Deno 1.9.0 and 1.9.1 the request.url of the native HTTP started
      // returning the full URL, where previously it only returned the path
      // so we will try to use that URL here, but default back to old logic
      // if the URL isn't valid.
      try {
        if (serverRequest.rawUrl) {
          this.#url = new URL(serverRequest.rawUrl);
        }
      } catch {
        // we don't care about errors here
      }
      if (this.#proxy || !this.#url) {
        let proto: string;
        let host: string;
        if (this.#proxy) {
          const xForwardedProto = serverRequest.headers.get("x-forwarded-proto");
          let maybeProto = xForwardedProto
            ? xForwardedProto.split(",", 1)[0].trim().toLowerCase()
            : undefined;
          if (maybeProto !== "http" && maybeProto !== "https") {
            maybeProto = undefined;
          }
          proto = maybeProto ?? "http";
          host = serverRequest.headers.get("x-forwarded-host") ??
            this.#url?.hostname ??
            serverRequest.headers.get("host") ??
            serverRequest.headers.get(":authority") ?? "";
        } else {
          proto = this.#secure ? "https" : "http";
          host = serverRequest.headers.get("host") ??
            serverRequest.headers.get(":authority") ?? "";
        }
        try {
          this.#url = new URL(`${proto}://${host}${serverRequest.url}`);
        } catch {
          throw new TypeError(
            `The server request URL of "${proto}://${host}${serverRequest.url}" is invalid.`,
          );
        }
      }
    }
    return this.#url;
  }

  /** An object representing the requesting user agent. If the `User-Agent`
   * header isn't defined in the request, all the properties will be undefined.
   *
   * See [std/http/user_agent#UserAgent](https://deno.land/std@0.223/http/user_agent.ts?s=UserAgent)
   * for more information.
   */
  get userAgent(): UserAgent {
    return this.#userAgent;
  }

  constructor(
    serverRequest: ServerRequest,
    { proxy = false, secure = false, jsonBodyReviver }: OakRequestOptions = {},
  ) {
    this.#proxy = proxy;
    this.#secure = secure;
    this.#serverRequest = serverRequest;
    this.#body = new Body(serverRequest, jsonBodyReviver);
    this.#userAgent = new UserAgent(serverRequest.headers.get("user-agent"));
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

  /** Take the current request and initiate server sent event connection.
   *
   * > ![WARNING]
   * > This is not intended for direct use, as it will not manage the target in
   * > the overall context or ensure that additional middleware does not attempt
   * > to respond to the request.
   */
  async sendEvents(
    options?: ServerSentEventTargetOptions,
    init?: RequestInit,
  ): Promise<ServerSentEventTarget> {
    const sse = new ServerSentEventStreamTarget(options);
    await this.#serverRequest.respond(sse.asResponse(init));
    return sse;
  }

  /** Take the current request and upgrade it to a web socket, returning a web
   * standard `WebSocket` object.
   *
   * If the underlying server abstraction does not support upgrades, this will
   * throw.
   *
   * > ![WARNING]
   * > This is not intended for direct use, as it will not manage the websocket
   * > in the overall context or ensure that additional middleware does not
   * > attempt to respond to the request.
   */
  upgrade(options?: UpgradeWebSocketOptions): WebSocket {
    if (!this.#serverRequest.upgrade) {
      throw new TypeError("Web sockets upgrade not supported in this runtime.");
    }
    return this.#serverRequest.upgrade(options);
  }

  [Symbol.for("Deno.customInspect")](
    inspect: (value: unknown) => string,
  ): string {
    const { body, hasBody, headers, ip, ips, method, secure, url, userAgent } =
      this;
    return `${this.constructor.name} ${
      inspect({
        body,
        hasBody,
        headers,
        ip,
        ips,
        method,
        secure,
        url: url.toString(),
        userAgent,
      })
    }`;
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
    const { body, hasBody, headers, ip, ips, method, secure, url, userAgent } =
      this;
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect(
        { body, hasBody, headers, ip, ips, method, secure, url, userAgent },
        newOptions,
      )
    }`;
  }
}
