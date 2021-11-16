import * as denoShim from "deno.ns";
// Copyright 2021 Deno Land Inc. All rights reserved. MIT license.

import type { FetchMessageBody } from "../types.d.js";

export function assert(cond: unknown, msg = "Assertion failed"): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

export type DeferredState = "pending" | "rejected" | "resolved";

export class Deferred<T> {
  #promise: Promise<T>;
  // deno-lint-ignore no-explicit-any
  #reject!: (reason?: any) => void;
  #resolve!: (value: T | PromiseLike<T>) => void;
  #settled = false;
  #state: DeferredState = "pending";
  #strict: boolean;

  get promise(): Promise<T> {
    return this.#promise;
  }

  get state(): DeferredState {
    return this.#state;
  }

  constructor(strict = false) {
    this.#promise = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
    this.#strict = strict;
  }

  // deno-lint-ignore no-explicit-any
  reject(reason?: any) {
    if (this.#settled && this.#strict) {
      throw new TypeError("Already settled.");
    }
    this.#reject(reason);
    if (!this.#settled) {
      this.#settled = true;
      this.#state = "rejected";
    }
  }

  resolve(value: T | PromiseLike<T>) {
    if (this.#settled && this.#strict) {
      throw new TypeError("Already settled.");
    }
    this.#resolve(value);
    if (!this.#settled) {
      this.#settled = true;
      this.#state = "resolved";
    }
  }
}

export function createBlobUrl(code: string): string {
  const blob = new denoShim.Blob([code], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

export async function checkPermissions(specifier: string | URL) {
  const descriptors: denoShim.Deno.PermissionDescriptor[] = [];
  const selfSpecifier = new URL(import.meta.url);
  if (typeof specifier === "string") {
    specifier = new URL(specifier, import.meta.url);
  }
  if (selfSpecifier.protocol === "file:") {
    // TODO(@kitsonk) narrow to just the path of the root directory
    descriptors.push({ name: "read" });
  } else if (selfSpecifier.protocol.startsWith("http")) {
    descriptors.push({ name: "net", host: selfSpecifier.host });
  }
  if (specifier.protocol === "file:") {
    descriptors.push({ name: "read" });
  }
  // TODO(@kitsonk) need `Deno.info` to figure out all dependencies here for
  // the specifier, so we will just request net access
  descriptors.push({ name: "net" });
  for (const desc of descriptors) {
    const granted = await denoShim.Deno.permissions.request(desc);
    if (!granted) {
      throw new Error(
        `dectyl requires the permission "${
          denoShim.Deno.inspect(desc)
        }" to function, which was not granted.`,
      );
    }
  }
}

export function checkUnstable() {
  if (!(Deno && "emit" in Deno)) {
    throw new Error(
      "The `Deno.emit` API is not present but required. Please run this again with the `--unstable` flag.",
    );
  }
}

export function parseBodyInit(
  input: string | denoShim.Request,
  requestInit: RequestInit,
): [
  FetchMessageBody,
  ReadableStream<Uint8Array> | undefined,
  [string, string][] | undefined,
] {
  assert(requestInit.body);
  if (requestInit.body instanceof ReadableStream) {
    return [{ type: "stream" }, requestInit.body, undefined];
  }
  if (requestInit.body instanceof URLSearchParams) {
    const value = [...requestInit.body];
    return [{ type: "urlsearchparams", value }, undefined, undefined];
  }
  if (requestInit.body instanceof FormData) {
    const request = new denoShim.Request(input, requestInit);
    assert(request.body);
    const headers = [...request.headers];
    return [
      { type: "stream" },
      request.body,
      headers.length ? headers : undefined,
    ];
  }
  return [{ type: "cloned", value: requestInit.body }, undefined, undefined];
}

export function parseHeaders(
  defaultHeaders: Record<string, string>,
  headers?: HeadersInit,
): [string, string][] {
  const h = new denoShim.Headers(headers);
  for (const [key, value] of Object.entries(defaultHeaders)) {
    if (!h.has(key)) {
      h.set(key, value);
    }
  }
  return [...h];
}
