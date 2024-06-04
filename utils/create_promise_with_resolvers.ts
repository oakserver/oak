// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/** Memoisation of the feature detection of `Promise.withResolvers` */
const hasPromiseWithResolvers = "withResolvers" in Promise;

/**
 * Offloads to the native `Promise.withResolvers` when available.
 *
 * Currently Node.js does not support it, while Deno does.
 */
export function createPromiseWithResolvers<T>(): PromiseWithResolvers<T> {
  if (hasPromiseWithResolvers) {
    return Promise.withResolvers<T>();
  }
  let resolve;
  let reject;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}
