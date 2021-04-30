// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

import type { State } from "./application.ts";
import type { Context } from "./context.ts";
import { createHash } from "./deps.ts";
import type { Middleware } from "./middleware.ts";
import { BODY_TYPES, isAsyncIterable, isReader } from "./util.ts";

export interface ETagOptions {
  /** Override the default behavior of calculating the `ETag`, either forcing
   * a tag to be labelled weak or not. */
  weak?: boolean;
}

/**
 * Just the part of `Deno.FileInfo` that is required to calculate an `ETag`,
 * so partial or user generated file information can be passed.
 */
export interface FileInfo {
  mtime: Date | null;
  size: number;
}

function isFileInfo(value: unknown): value is FileInfo {
  return Boolean(
    value && typeof value === "object" && "mtime" in value && "size" in value,
  );
}

function calcStatTag(entity: FileInfo): string {
  const mtime = entity.mtime?.getTime().toString(16) ?? "0";
  const size = entity.size.toString(16);

  return `"${size}-${mtime}"`;
}

function calcEntityTag(entity: string | Uint8Array): string {
  if (entity.length === 0) {
    return `"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk="`;
  }

  const hash = createHash("sha1")
    .update(entity)
    .toString("base64")
    .substring(0, 27);

  return `"${entity.length.toString(16)}-${hash}"`;
}

function fstat(file: Deno.File): Promise<Deno.FileInfo | undefined> {
  if ("fstat" in Deno) {
    // deno-lint-ignore no-explicit-any
    return (Deno as any).fstat(file.rid);
  }
  return Promise.resolve(undefined);
}

/** For a given Context, try to determine the response body entity that an ETag
 * can be calculated from. */
// deno-lint-ignore no-explicit-any
export function getEntity<S extends State = Record<string, any>>(
  context: Context<S>,
): Promise<string | Uint8Array | Deno.FileInfo | undefined> {
  const { body } = context.response;
  if (body instanceof Deno.File) {
    return fstat(body);
  }
  if (body instanceof Uint8Array) {
    return Promise.resolve(body);
  }
  if (BODY_TYPES.includes(typeof body)) {
    return Promise.resolve(String(body));
  }
  if (isAsyncIterable(body) || isReader(body)) {
    return Promise.resolve(undefined);
  }
  if (typeof body === "object" && body !== null) {
    try {
      const bodyText = JSON.stringify(body);
      return Promise.resolve(bodyText);
    } catch {
      // We don't really care about errors here
    }
  }
  return Promise.resolve(undefined);
}

/**
 * Calculate an ETag value for an entity. If the entity is `FileInfo`, then the
 * tag will default to a _weak_ ETag.  `options.weak` overrides any default
 * behavior in generating the tag.
 *
 * @param entity A string, Uint8Array, or file info to use to generate the ETag
 * @param options
 */
export function calculate(
  entity: string | Uint8Array | FileInfo,
  options: ETagOptions = {},
): string {
  const weak = options.weak ?? isFileInfo(entity);
  const tag = isFileInfo(entity) ? calcStatTag(entity) : calcEntityTag(entity);

  return weak ? `W/${tag}` : tag;
}

/**
 * Create middleware that will attempt to decode the response.body into
 * something that can be used to generate an `ETag` and add the `ETag` header to
 * the response.
 */
// deno-lint-ignore no-explicit-any
export function factory<S extends State = Record<string, any>>(
  options?: ETagOptions,
): Middleware<S> {
  return async function etag(context: Context<S>, next) {
    await next();
    if (!context.response.headers.has("ETag")) {
      const entity = await getEntity(context);
      if (entity) {
        context.response.headers.set("ETag", calculate(entity, options));
      }
    }
  };
}

/**
 * A helper function that takes the value from the `If-Match` header and an
 * entity and returns `true` if the `ETag` for the entity matches the supplied
 * value, otherwise `false`.
 *
 * See MDN's [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)
 * article for more information on how to use this function.
 */
export function ifMatch(
  value: string,
  entity: string | Uint8Array | FileInfo,
  options: ETagOptions = {},
): boolean {
  const etag = calculate(entity, options);
  // Weak tags cannot be matched and return false.
  if (etag.startsWith("W/")) {
    return false;
  }
  if (value.trim() === "*") {
    return true;
  }
  const tags = value.split(/\s*,\s*/);
  return tags.includes(etag);
}

/**
 * A helper function that takes the value from the `If-No-Match` header and
 * an entity and returns `false` if the `ETag` for the entity matches the
 * supplied value, otherwise `false`.
 *
 * See MDN's [`If-None-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
 * article for more information on how to use this function.
 */
export function ifNoneMatch(
  value: string,
  entity: string | Uint8Array | FileInfo,
  options: ETagOptions = {},
): boolean {
  if (value.trim() === "*") {
    return false;
  }
  const etag = calculate(entity, options);
  const tags = value.split(/\s*,\s*/);
  return !tags.includes(etag);
}
