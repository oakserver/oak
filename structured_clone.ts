// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

export type StructuredClonable =
  | { [key: string]: StructuredClonable }
  | Array<StructuredClonable>
  | ArrayBuffer
  | ArrayBufferView
  | BigInt
  | bigint
  | Blob
  // deno-lint-ignore ban-types
  | Boolean
  | boolean
  | Date
  | Error
  | EvalError
  | Map<StructuredClonable, StructuredClonable>
  // deno-lint-ignore ban-types
  | Number
  | number
  | RangeError
  | ReferenceError
  | RegExp
  | Set<StructuredClonable>
  // deno-lint-ignore ban-types
  | String
  | string
  | SyntaxError
  | TypeError
  | URIError;

declare global {
  namespace Deno {
    var core: {
      deserialize(value: unknown): StructuredClonable;
      serialize(value: StructuredClonable): unknown;
    };
  }
}

const { core } = Deno;

/**
 * Provides structured cloning
 * @param value 
 * @returns 
 */
export function structuredClone<T extends StructuredClonable>(value: T): T {
  return core.deserialize(core.serialize(value)) as T;
}
