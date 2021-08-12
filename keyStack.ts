// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

// This was inspired by [keygrip](https://github.com/crypto-utils/keygrip/)
// which allows signing of data (cookies) to prevent tampering, but also allows
// for easy key rotation without needing to resign the data.

import { compare } from "./tssCompare.ts";
import { encodeBase64Safe, importKey, sign } from "./util.ts";
import type { Data, Key } from "./types.d.ts";

export class KeyStack {
  #cryptoKeys = new Map<Key, CryptoKey>();
  #keys: Key[];

  async #toCryptoKey(key: Key): Promise<CryptoKey> {
    if (!this.#cryptoKeys.has(key)) {
      this.#cryptoKeys.set(key, await importKey(key));
    }
    return this.#cryptoKeys.get(key)!;
  }

  get length(): number {
    return this.#keys.length;
  }

  /** A class which accepts an array of keys that are used to sign and verify
   * data and allows easy key rotation without invalidation of previously signed
   * data.
   *
   * @param keys An array of keys, of which the index 0 will be used to sign
   *             data, but verification can happen against any key.
   */
  constructor(keys: Key[]) {
    if (!(0 in keys)) {
      throw new TypeError("keys must contain at least one value");
    }
    this.#keys = keys;
  }

  /** Take `data` and return a SHA256 HMAC digest that uses the current 0 index
   * of the `keys` passed to the constructor.  This digest is in the form of a
   * URL safe base64 encoded string. */
  async sign(data: Data): Promise<string> {
    const key = await this.#toCryptoKey(this.#keys[0]);
    return encodeBase64Safe(await sign(data, key));
  }

  /** Given `data` and a `digest`, verify that one of the `keys` provided the
   * constructor was used to generate the `digest`.  Returns `true` if one of
   * the keys was used, otherwise `false`. */
  async verify(data: Data, digest: string): Promise<boolean> {
    return (await this.indexOf(data, digest)) > -1;
  }

  /** Given `data` and a `digest`, return the current index of the key in the
   * `keys` passed the constructor that was used to generate the digest.  If no
   * key can be found, the method returns `-1`. */
  async indexOf(data: Data, digest: string): Promise<number> {
    for (let i = 0; i < this.#keys.length; i++) {
      const cryptoKey = await this.#toCryptoKey(this.#keys[i]);
      if (
        await compare(digest, encodeBase64Safe(await sign(data, cryptoKey)))
      ) {
        return i;
      }
    }
    return -1;
  }

  [Symbol.for("Deno.customInspect")](inspect: (value: unknown) => string) {
    return `${this.constructor.name} ${
      inspect({
        length: this.length,
      })
    }`;
  }
}
