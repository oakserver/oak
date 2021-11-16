import * as denoShim from "deno.ns";
// Copyright 2021 Deno Land Inc. All rights reserved. MIT license.

import { assert, assertEquals, AssertionError } from "../deps.js";

/** Asserts that there are no diagnostics returned, otherwise logs the
 * diagnostics to the console and throws. */
export function assertDiagnostics(diagnostics?: denoShim.Deno.Diagnostic[]): void {
  if (diagnostics?.length) {
    console.log(denoShim.Deno.formatDiagnostics(diagnostics));
    throw new AssertionError("Expected to not have any diagnostics.");
  }
}

/** Return a request init that mocks what a Chromium request would look like
 * from a client.
 *
 * @param referrer Optionally set the referrer header in the request init
 */
export function mockChromeRequest(
  referrer?: string,
): RequestInit {
  const headers = [[
    "accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  ], [
    "accept-encoding",
    "gzip, deflate, br",
  ], [
    "accept-language",
    "en-GB,en-US;q=0.9,en;q=0.8",
  ], [
    "sec-fetch-dest",
    "document",
  ], [
    "sec-fetch-mode",
    "navigate",
  ], [
    "sec-fetch-site",
    "cross-site",
  ], [
    "sec-fetch-user",
    "?1",
  ], [
    "sec-gpc",
    "1",
  ], [
    "upgrade-insecure-requests",
    "1",
  ], [
    "user-agent",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  ]];
  if (referrer != null) {
    headers.push(["referrer", referrer]);
  }
  return {
    headers,
  };
}

function equal(a: ArrayBuffer, b: ArrayBuffer) {
  const ua = new Uint8Array(a, 0);
  const ub = new Uint8Array(b, 0);
  if (ua.byteLength != b.byteLength) return false;
  if (aligned32(ua) && aligned32(ub)) {
    return equal32(ua, ub);
  }
  if (aligned16(ua) && aligned16(ub)) {
    return equal16(ua, ub);
  }
  return equal8(ua, ub);
}

function equal8(a: Uint8Array, b: Uint8Array) {
  const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  return compare(ua, ub);
}
function equal16(a: Uint8Array, b: Uint8Array) {
  const ua = new Uint16Array(a.buffer, a.byteOffset, a.byteLength / 2);
  const ub = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
  return compare(ua, ub);
}
function equal32(a: Uint8Array, b: Uint8Array) {
  const ua = new Uint32Array(a.buffer, a.byteOffset, a.byteLength / 4);
  const ub = new Uint32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  return compare(ua, ub);
}

function compare<T>(a: ArrayLike<T>, b: ArrayLike<T>) {
  for (let i = a.length; -1 < i; i -= 1) {
    if ((a[i] !== b[i])) return false;
  }
  return true;
}

function aligned16(a: Uint8Array) {
  return (a.byteOffset % 2 === 0) && (a.byteLength % 2 === 0);
}

function aligned32(a: Uint8Array) {
  return (a.byteOffset % 4 === 0) && (a.byteLength % 4 === 0);
}

export interface AssertRequestOptions {
  /** Ignore comparing the body.  This defaults to `false`. */
  ignoreBody?: boolean;
  /** Ignore comparing the headers. If an array of strings are provided, those
   * specific keys will not be checked (and the length of the entries in the
   * headers won't be compared). Ignored need should be normalized to a header
   * key, which is lowercase.  This defaults to `false`. */
  ignoreHeaders?: boolean | string[];
  /** Ignore the method. This defaults to `false`. */
  ignoreMethod?: boolean;
  /** Ignore the url. This defaults to `false`. */
  ignoreUrl?: boolean;
  /** If the `expected` is a `Request` or `string` then a `RequestInit` can be
   * provided in the options to create a new `Request` that will be used for
   * comparison. */
  requestInit?: RequestInit;
}

/** Asserts a request is effectively equal to the expected information. The
 * options can be used to control the behavior of the comparison. */
export async function assertRequest(
  actual: denoShim.Request,
  expected: denoShim.Request | string | RequestInit,
  options: AssertRequestOptions = {},
): Promise<void> {
  const {
    ignoreBody = false,
    ignoreHeaders = false,
    ignoreMethod = false,
    ignoreUrl = false,
    requestInit,
  } = options;
  let fixture: denoShim.Request;
  if (requestInit) {
    assert(
      expected instanceof Request || typeof expected === "string",
      "Request init provided in expected and options.",
    );
    fixture = new denoShim.Request(expected, requestInit);
  } else if (typeof expected === "string") {
    fixture = new denoShim.Request(expected);
  } else {
    fixture = (expected as denoShim.Request).clone();
  }
  actual = actual.clone();
  if (!ignoreBody) {
    if (actual.body === null) {
      assert(fixture.body === null, "Expected has body, actual does not");
    } else {
      assert(
        equal(await actual.arrayBuffer(), await fixture.arrayBuffer()),
        "Bodies are not equal.",
      );
    }
  }
  if (ignoreHeaders !== true) {
    let ignore: string[] = [];
    if (Array.isArray(ignoreHeaders)) {
      ignore = ignoreHeaders;
    } else {
      assertEquals(
        Array.from(actual.headers.keys()).length,
        Array.from(actual.headers.keys()).length,
        "Headers do not match",
      );
    }
    for (const key in actual.headers.keys()) {
      if (ignore.includes(key)) {
        continue;
      }
      assertEquals(
        actual.headers.get(key),
        fixture.headers.get(key),
        `The value of header "${key}" does not match.`,
      );
    }
  }
  if (!ignoreMethod) {
    assertEquals(actual.method, fixture.method);
  }
  if (!ignoreUrl) {
    assertEquals(actual.url, fixture.url);
  }
}

/** A helper function that creates a tuple with the information to create a
 * `Response` object.
 *
 * This will throw if the object cannot be parsed to JSON or if the `init`, if
 * supplied, does not contain a simple record object for the `headers`.
 *
 * @param body The object to parse into a JSON string
 * @param init Optional `ResponseInit`
 */
export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): [BodyInit, ResponseInit] {
  const bodyInit = JSON.stringify(body);
  if (init && init.headers) {
    if (
      typeof init.headers === "object" &&
      !Array.isArray(init.headers) &&
      !(init.headers instanceof Headers)
    ) {
      init.headers = {
        ...init.headers,
        "content-type": "application/json",
      };
    } else {
      throw new SyntaxError(
        "Only a record object of headers is support in response init",
      );
    }
  } else {
    init.headers = { "content-type": "application/json" };
  }
  return [bodyInit, init];
}
