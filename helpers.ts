// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

/**
 * A collection of APIs to help assist in creating middleware.
 *
 * @module
 */

import type { Context } from "./context.ts";
import type { RouterContext } from "./router.ts";
import { isRouterContext } from "./util.ts";

interface GetQueryOptionsBase {
  /** The return value should be a `Map` instead of a record object. */
  asMap?: boolean;

  /** Merge in the context's `.params`.  This only works when a `RouterContext`
   * is passed. */
  mergeParams?: boolean;
}

interface GetQueryOptionsAsMap extends GetQueryOptionsBase {
  /** The return value should be a `Map` instead of a record object. */
  asMap: true;
}

export type GetParamsOptions = GetQueryOptionsBase | GetQueryOptionsAsMap;

/** Given a context, return the `.request.url.searchParams` as a `Map` of keys
 * and values of the params. */
export function getQuery(
  ctx: Context | RouterContext<string>,
  options: GetQueryOptionsAsMap,
): Map<string, string>;
/** Given a context, return the `.request.url.searchParams` as a record object
 * of keys and values of the params. */
export function getQuery(
  ctx: Context | RouterContext<string>,
  options?: GetQueryOptionsBase,
): Record<string, string>;
export function getQuery(
  ctx: Context | RouterContext<string>,
  { mergeParams, asMap }: GetParamsOptions = {},
): Map<string, string> | Record<string, string> {
  const result: Record<string, string> = {};
  if (mergeParams && isRouterContext(ctx)) {
    Object.assign(result, ctx.params);
  }
  for (const [key, value] of ctx.request.url.searchParams) {
    result[key] = value;
  }
  return asMap ? new Map(Object.entries(result)) : result;
}


export function createObjectForField(
  obj: Record<string, unknown>,
  string: string,
  value: unknown,
): Record<string, unknown> {
  // "reminder[fulfilled][id][]"
  const [root, ...nestedKeys] = string.split("[").filter((i) => i !== "]").map(
    (i) => i.split("]")[0],
  );
  // root -> reminder, nestedKeys -> [fulfilled, id]

  // quick return in case object has no nested keys
  if (nestedKeys.length === 0) {
    obj[root] = value;
    return obj;
  }

  // check to see that object has the property
  if (!Object.prototype.hasOwnProperty.call(obj, root)) obj[root] = {};

  // identification of array cases for handling down the chain
  let isArrayCase = false;
  if (string.endsWith("[]")) {
    isArrayCase = true;
  }

  // Additionally also check if the array already exists in which case direct push should be allowed

  // [reminder, fulfilled, id]

  nestedKeys.reduce((prev: Record<string, unknown>, currentKey) => {
    if (currentKey === nestedKeys[nestedKeys.length - 1]) {
      if (isArrayCase) {
        if (
          Object.prototype.hasOwnProperty.call(prev, currentKey)
        ) {
          {
            const curVal = prev[currentKey];
            if (Array.isArray(curVal)) {
              curVal.push(value);
            }
          }
        } else {
          prev[currentKey] = [value];
        }
      } else {
        prev[currentKey] = value;
      }
    }

    if (Object.prototype.hasOwnProperty.call(prev, currentKey)) {
      return prev[currentKey] as Record<string, unknown>;
    } else {
      prev[currentKey] = {};
      return prev[currentKey] as Record<string, unknown>;
    }
  }, obj[root] as Record<string, unknown>);
  return obj;
}