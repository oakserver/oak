// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/** Clones a state object, skipping any values that cannot be cloned. */
// deno-lint-ignore no-explicit-any
export function cloneState<S extends Record<string, any>>(state: S): S {
  const clone = {} as S;
  for (const [key, value] of Object.entries(state)) {
    try {
      const clonedValue = structuredClone(value);
      clone[key as keyof S] = clonedValue;
    } catch {
      // we just no-op values that cannot be cloned
    }
  }
  return clone;
}
