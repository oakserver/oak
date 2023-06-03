// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.

/**
 * A collection of oak specific APIs for management of ETags.
 *
 * @module
 */

import type { State } from "./application.ts";
import type { Context } from "./context.ts";
import { calculate, type ETagOptions } from "./deps.ts";
import type { Middleware } from "./middleware.ts";
import { BODY_TYPES, isAsyncIterable, isReader } from "./util.ts";

// re-exports to maintain backwards compatibility
export {
  calculate,
  type ETagOptions,
  type FileInfo,
  ifMatch,
  ifNoneMatch,
} from "./deps.ts";

function fstat(file: Deno.FsFile): Promise<Deno.FileInfo | undefined> {
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
  if (body instanceof Deno.FsFile) {
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
        const etag = await calculate(entity, options);
        if (etag) {
          context.response.headers.set("ETag", etag);
        }
      }
    }
  };
}
