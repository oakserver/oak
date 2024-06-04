// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import type { State } from "../application.ts";
import type { Context } from "../context.ts";
import type { RouteParams, RouterContext } from "../router.ts";
import type { NetAddr } from "../types.ts";

import "../node_shims.ts";

/** Guard for Async Iterables */
export function isAsyncIterable(
  value: unknown,
): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null &&
    Symbol.asyncIterator in value &&
    // deno-lint-ignore no-explicit-any
    typeof (value as any)[Symbol.asyncIterator] === "function";
}

export function isBun(): boolean {
  return "Bun" in globalThis;
}

/** Determines if a string "looks" like HTML */
export function isHtml(value: string): boolean {
  return /^\s*<(?:!DOCTYPE|html|body)/i.test(value);
}

export function isListenTlsOptions(
  value: unknown,
): value is Deno.ListenTlsOptions {
  return typeof value === "object" && value !== null &&
    ("cert" in value || "certFile" in value) &&
    ("key" in value || "keyFile" in value) && "port" in value;
}

export function isNetAddr(value: unknown): value is NetAddr {
  return typeof value === "object" && value != null && "transport" in value &&
    "hostname" in value && "port" in value;
}

export function isNode(): boolean {
  return "process" in globalThis && "global" in globalThis &&
    !("Bun" in globalThis) && !("WebSocketPair" in globalThis);
}

/** Guard for `Deno.Reader`. */
export function isReader(value: unknown): value is Deno.Reader {
  return typeof value === "object" && value !== null && "read" in value &&
    typeof (value as Record<string, unknown>).read === "function";
}

export function isRouterContext<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(
  value: Context<S>,
): value is RouterContext<R, P, S> {
  return "params" in value;
}
