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

const objectCloneMemo = new WeakMap();

function cloneArrayBuffer(
  srcBuffer: ArrayBuffer,
  srcByteOffset: number,
  srcLength: number,
  // deno-lint-ignore no-explicit-any
  _cloneConstructor: any,
) {
  // this function fudges the return type but SharedArrayBuffer is disabled for a while anyway
  return srcBuffer.slice(
    srcByteOffset,
    srcByteOffset + srcLength,
  );
}

/** A loose approximation for structured cloning, used when the `Deno.core`
 * APIs are not available. */
// deno-lint-ignore no-explicit-any
function cloneValue(value: any): any {
  switch (typeof value) {
    case "number":
    case "string":
    case "boolean":
    case "undefined":
    case "bigint":
      return value;
    case "object": {
      if (objectCloneMemo.has(value)) {
        return objectCloneMemo.get(value);
      }
      if (value === null) {
        return value;
      }
      if (value instanceof Date) {
        return new Date(value.valueOf());
      }
      if (value instanceof RegExp) {
        return new RegExp(value);
      }
      if (value instanceof SharedArrayBuffer) {
        return value;
      }
      if (value instanceof ArrayBuffer) {
        const cloned = cloneArrayBuffer(
          value,
          0,
          value.byteLength,
          ArrayBuffer,
        );
        objectCloneMemo.set(value, cloned);
        return cloned;
      }
      if (ArrayBuffer.isView(value)) {
        const clonedBuffer = cloneValue(value.buffer);
        // Use DataViewConstructor type purely for type-checking, can be a
        // DataView or TypedArray.  They use the same constructor signature,
        // only DataView has a length in bytes and TypedArrays use a length in
        // terms of elements, so we adjust for that.
        let length;
        if (value instanceof DataView) {
          length = value.byteLength;
        } else {
          // deno-lint-ignore no-explicit-any
          length = (value as any).length;
        }
        // deno-lint-ignore no-explicit-any
        return new (value.constructor as any)(
          clonedBuffer,
          value.byteOffset,
          length,
        );
      }
      if (value instanceof Map) {
        const clonedMap = new Map();
        objectCloneMemo.set(value, clonedMap);
        value.forEach((v, k) => {
          clonedMap.set(cloneValue(k), cloneValue(v));
        });
        return clonedMap;
      }
      if (value instanceof Set) {
        // assumes that cloneValue still takes only one argument
        const clonedSet = new Set([...value].map(cloneValue));
        objectCloneMemo.set(value, clonedSet);
        return clonedSet;
      }

      // default for objects
      // deno-lint-ignore no-explicit-any
      const clonedObj: Record<any, any> = {};
      objectCloneMemo.set(value, clonedObj);
      const sourceKeys = Object.getOwnPropertyNames(value);
      for (const key of sourceKeys) {
        clonedObj[key] = cloneValue(value[key]);
      }
      Reflect.setPrototypeOf(clonedObj, Reflect.getPrototypeOf(value));
      return clonedObj;
    }
    case "symbol":
    case "function":
    default:
      throw new DOMException("Uncloneable value in stream", "DataCloneError");
  }
}

const { core } = Deno;

/**
 * Provides structured cloning
 * @param value
 * @returns
 */
export function structuredClone<T extends StructuredClonable>(value: T): T {
  return core ? core.deserialize(core.serialize(value)) : cloneValue(value);
}
