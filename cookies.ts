// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

// This was heavily influenced by
// [cookies](https://github.com/pillarjs/cookies/blob/master/index.js)

import type { KeyStack } from "./keyStack.ts";
import type { Request } from "./request.ts";
import type { Response } from "./response.ts";

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
  /** For use in situations where requests are presented to Deno as "insecure"
   * but are otherwise secure and so secure cookies can be treated as secure. */
  ignoreInsecure?: boolean;
  maxAge?: number;
  overwrite?: boolean;
  path?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none" | boolean;
  signed?: boolean;
}

type CookieAttributes = CookiesSetDeleteOptions;

const matchCache: Record<string, RegExp> = {};

// deno-lint-ignore no-control-regex
const FIELD_CONTENT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const KEY_REGEXP = /(?:^|;) *([^=]*)=[^;]*/g;
const SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;

function getPattern(name: string): RegExp {
  if (name in matchCache) {
    return matchCache[name];
  }

  return matchCache[name] = new RegExp(
    `(?:^|;) *${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`,
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
  path = "/";
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
      this.expires = new Date(Date.now() + (this.maxAge * 1000));
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

/** An interface which allows setting and accessing cookies related to both the
 * current request and response. Each {@linkcode Context} has a property
 * `.cookies` which is an instance of this class.
 *
 * Because oak supports automatic encryption, most methods (except `.delete`)
 * are asynchronous. This is because oak leverages the Web Crypto APIs, which
 * are asynchronous by nature.
 *
 * ### Example
 *
 * ```ts
 * import { Application } from "https://deno.land/x/oak/mod.ts";
 *
 * const app = new Application();
 *
 * app.use(async (ctx) => {
 *   for await (const cookie of ctx.cookies) {
 *     // iterating over each cookie
 *   }
 *   await ctx.cookie.set("myCookie", "a value"); // setting or updating a cookie
 *   const id = await ctx.cookie.get("my-id"); // getting a value of a cookie if present
 *   ctx.cookie.delete();
 * });
 * ```
 */
export class Cookies {
  #cookieKeys?: string[];
  #keys?: KeyStack;
  #request: Request;
  #response: Response;
  #secure?: boolean;

  #requestKeys(): string[] {
    if (this.#cookieKeys) {
      return this.#cookieKeys;
    }
    const result = this.#cookieKeys = [] as string[];
    const header = this.#request.headers.get("cookie");
    if (!header) {
      return result;
    }
    let matches: RegExpExecArray | null;
    while ((matches = KEY_REGEXP.exec(header))) {
      const [, key] = matches;
      result.push(key);
    }
    return result;
  }

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

  /** Set a cookie to be deleted in the response.  This is a "shortcut" to
   * `.set(name, null, options?)`. */
  delete(name: string, options: CookiesSetDeleteOptions = {}): boolean {
    this.set(name, null, options);
    return true;
  }

  /** Iterate over the request's cookies, yielding up a tuple containing the
   * key and the value.
   *
   * If there are keys set on the application, only keys and values that are
   * properly signed will be returned. */
  async *entries(): AsyncIterableIterator<[string, string]> {
    const keys = this.#requestKeys();
    for (const key of keys) {
      const value = await this.get(key);
      if (value) {
        yield [key, value];
      }
    }
  }

  async forEach(
    callback: (key: string, value: string, cookies: this) => void,
    // deno-lint-ignore no-explicit-any
    thisArg: any = null,
  ): Promise<void> {
    const keys = this.#requestKeys();
    for (const key of keys) {
      const value = await this.get(key);
      if (value) {
        callback.call(thisArg, key, value, this);
      }
    }
  }

  /** Get the value of a cookie from the request.
   *
   * If the cookie is signed, and the signature is invalid, the cookie will
   * be set to be deleted in the the response.  If the signature uses an "old"
   * key, the cookie will be re-signed with the current key and be added to the
   * response to be updated. */
  async get(
    name: string,
    options: CookiesGetOptions = {},
  ): Promise<string | undefined> {
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
    const digest = await this.get(nameSig, { signed: false });
    if (!digest) {
      return;
    }
    const data = `${name}=${value}`;
    if (!this.#keys) {
      throw new TypeError("keys required for signed cookies");
    }
    const index = await this.#keys.indexOf(data, digest);

    if (index < 0) {
      this.delete(nameSig, { path: "/", signed: false });
    } else {
      if (index) {
        // the key has "aged" and needs to be re-signed
        this.set(nameSig, await this.#keys.sign(data), { signed: false });
      }
      return value;
    }
  }

  /** Iterate over the request's cookies, yielding up the keys.
   *
   * If there are keys set on the application, only the keys that are properly
   * signed will be returned. */
  async *keys(): AsyncIterableIterator<string> {
    const keys = this.#requestKeys();
    for (const key of keys) {
      const value = await this.get(key);
      if (value) {
        yield key;
      }
    }
  }

  /** Set a cookie in the response.
   *
   * If there are keys set in the application, cookies will be automatically
   * signed, unless overridden by the set options.  Cookies can be deleted by
   * setting the value to `null`. */
  async set(
    name: string,
    value: string | null,
    options: CookiesSetDeleteOptions = {},
  ): Promise<this> {
    const request = this.#request;
    const response = this.#response;
    const headers: string[] = [];
    for (const [key, value] of response.headers.entries()) {
      if (key === "set-cookie") {
        headers.push(value);
      }
    }
    const secure = this.#secure !== undefined ? this.#secure : request.secure;
    const signed = options.signed ?? !!this.#keys;

    if (!secure && options.secure && !options.ignoreInsecure) {
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
      cookie.value = await this.#keys.sign(cookie.toString());
      cookie.name += ".sig";
      pushCookie(headers, cookie);
    }

    response.headers.delete("Set-Cookie");
    for (const header of headers) {
      response.headers.append("Set-Cookie", header);
    }
    return this;
  }

  /** Iterate over the request's cookies, yielding up each value.
   *
   * If there are keys set on the application, only the values that are
   * properly signed will be returned. */
  async *values(): AsyncIterableIterator<string> {
    const keys = this.#requestKeys();
    for (const key of keys) {
      const value = await this.get(key);
      if (value) {
        yield value;
      }
    }
  }

  /** Iterate over the request's cookies, yielding up a tuple containing the
   * key and the value.
   *
   * If there are keys set on the application, only keys and values that are
   * properly signed will be returned. */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<[string, string]> {
    const keys = this.#requestKeys();
    for (const key of keys) {
      const value = await this.get(key);
      if (value) {
        yield [key, value];
      }
    }
  }

  [Symbol.for("Deno.customInspect")]() {
    return `${this.constructor.name} []`;
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
    return `${options.stylize(this.constructor.name, "special")} ${
      inspect([], newOptions)
    }`;
  }
}
