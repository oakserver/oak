// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

// This was heavily influenced by
// [cookies](https://github.com/pillarjs/cookies/blob/master/index.js)

import { KeyStack } from "./keyStack.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

export interface CookiesOptions {
  keys?: KeyStack;
  secure?: boolean;
}

export interface CookiesGetOptions {
  signed?: boolean;
}

export interface CookiesSetDeleteOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  overwrite?: boolean;
  path?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none" | boolean;
  signed?: boolean;
}

type CookieAttributes = CookiesSetDeleteOptions;

const matchCache: Record<string, RegExp> = {};

const FIELD_CONTENT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;

function getPattern(name: string): RegExp {
  if (name in matchCache) {
    return matchCache[name];
  }

  return matchCache[name] = new RegExp(
    "(?:^|;) *" +
      name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") +
      "=([^;]*)",
  );
}

function pushCookie(headers: string[], cookie: Cookie): void {
  if (cookie.overwrite) {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].indexOf(`${cookie.name}=`) === 0) {
        headers.splice(i, 1);
      }
    }
  }
  headers.push(cookie.toHeader());
}

function validateCookieProperty(
  key: string,
  value: string | undefined | null,
): void {
  if (value && !FIELD_CONTENT_REGEXP.test(value)) {
    throw new TypeError(`The ${key} of the cookie (${value}) is invalid.`);
  }
}

class Cookie implements CookieAttributes {
  domain?: string;
  expires?: Date;
  httpOnly = true;
  maxAge?: number;
  name: string;
  overwrite = false;
  path: string = "/";
  sameSite: "strict" | "lax" | "none" | boolean = false;
  secure = false;
  signed?: boolean;
  value: string;

  /** A logical representation of a cookie, used to internally manage the
   * cookie instances. */
  constructor(
    name: string,
    value: string | null,
    attributes: CookieAttributes,
  ) {
    validateCookieProperty("name", name);
    validateCookieProperty("value", value);
    this.name = name;
    this.value = value ?? "";
    Object.assign(this, attributes);
    if (!this.value) {
      this.expires = new Date(0);
      this.maxAge = undefined;
    }

    validateCookieProperty("path", this.path);
    validateCookieProperty("domain", this.domain);
    if (
      this.sameSite && typeof this.sameSite === "string" &&
      !SAME_SITE_REGEXP.test(this.sameSite)
    ) {
      throw new TypeError(
        `The sameSite of the cookie ("${this.sameSite}") is invalid.`,
      );
    }
  }

  toHeader(): string {
    let header = this.toString();
    if (this.maxAge) {
      this.expires = new Date(Date.now() + this.maxAge);
    }

    if (this.path) {
      header += `; path=${this.path}`;
    }
    if (this.expires) {
      header += `; expires=${this.expires.toUTCString()}`;
    }
    if (this.domain) {
      header += `; domain=${this.domain}`;
    }
    if (this.sameSite) {
      header += `; samesite=${
        this.sameSite === true ? "strict" : this.sameSite.toLowerCase()
      }`;
    }
    if (this.secure) {
      header += "; secure";
    }
    if (this.httpOnly) {
      header += "; httponly";
    }

    return header;
  }

  toString(): string {
    return `${this.name}=${this.value}`;
  }
}

export class Cookies {
  #keys?: KeyStack;
  #request: Request;
  #response: Response;
  #secure?: boolean;

  constructor(
    request: Request,
    response: Response,
    options: CookiesOptions = {},
  ) {
    const { keys, secure } = options;
    this.#keys = keys;
    this.#request = request;
    this.#response = response;
    this.#secure = secure;
  }

  /** Get the value of a cookie from the request.
   * 
   * If the cookie is signed, and the signature is invalid, the cookie will
   * be set to be deleted in the the response.  If the signature uses an "old"
   * key, the cookie will be re-signed with the current key and be added to the
   * response to be updated. */
  get(name: string, options: CookiesGetOptions = {}): string | undefined {
    const signed = options.signed ?? !!this.#keys;
    const nameSig = `${name}.sig`;

    const header = this.#request.headers.get("cookie");
    if (!header) {
      return;
    }
    const match = header.match(getPattern(name));
    if (!match) {
      return;
    }
    const [, value] = match;
    if (!signed) {
      return value;
    }
    const digest = this.get(nameSig, { signed: false });
    if (!digest) {
      return;
    }
    const data = `${name}=${value}`;
    if (!this.#keys) {
      throw new TypeError("keys required for signed cookies");
    }
    const index = this.#keys.indexOf(data, digest);

    if (index < 0) {
      this.delete(nameSig, { path: "/", signed: false });
    } else {
      if (index) {
        // the key has "aged" and needs to be re-signed
        this.set(nameSig, this.#keys.sign(data), { signed: false });
      }
      return value;
    }
  }

  /** Set a cookie in the response.
   * 
   * If there are keys set in the application, cookies will be automatically
   * signed, unless overridden by the set options.  Cookies can be deleted by
   * setting the value to `null`. */
  set(
    name: string,
    value: string | null,
    options: CookiesSetDeleteOptions = {},
  ): this {
    const request = this.#request;
    const response = this.#response;
    let headers = response.headers.get("Set-Cookie") ?? [] as string[];
    if (typeof headers === "string") {
      headers = [headers];
    }
    const secure = this.#secure !== undefined ? this.#secure : request.secure;
    const signed = options.signed ?? !!this.#keys;

    if (!secure && options.secure) {
      throw new TypeError(
        "Cannot send secure cookie over unencrypted connection.",
      );
    }

    const cookie = new Cookie(name, value, options);
    cookie.secure = options.secure ?? secure;
    pushCookie(headers, cookie);

    if (signed) {
      if (!this.#keys) {
        throw new TypeError(".keys required for signed cookies.");
      }
      cookie.value = this.#keys.sign(cookie.toString());
      cookie.name += ".sig";
      pushCookie(headers, cookie);
    }

    for (const header of headers) {
      response.headers.append("Set-Cookie", header);
    }
    return this;
  }

  /** Set a cookie to be deleted in the response.  This is a "shortcut" to
   * `.set(name, null, options?)`. */
  delete(name: string, options: CookiesSetDeleteOptions = {}): boolean {
    this.set(name, null, options);
    return true;
  }
}
