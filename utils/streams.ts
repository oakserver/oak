// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { BODY_TYPES } from "./consts.ts";

const encoder = new TextEncoder();

/**
 * Create a `ReadableStream<Uint8Array>` from an `AsyncIterable`.
 */
export function readableStreamFromAsyncIterable(
  source: AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of source) {
        if (BODY_TYPES.includes(typeof chunk)) {
          controller.enqueue(encoder.encode(String(chunk)));
        } else if (chunk instanceof Uint8Array) {
          controller.enqueue(chunk);
        } else if (ArrayBuffer.isView(chunk)) {
          controller.enqueue(new Uint8Array(chunk.buffer));
        } else if (chunk instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(chunk));
        } else {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(chunk)));
          } catch {
            // we just swallow errors here
          }
        }
      }
      controller.close();
    },
  });
}

/** A utility class that transforms "any" chunk into an `Uint8Array`. */
export class Uint8ArrayTransformStream
  extends TransformStream<unknown, Uint8Array> {
  constructor() {
    const init = {
      async transform(
        chunk: unknown,
        controller: TransformStreamDefaultController<Uint8Array>,
      ) {
        chunk = await chunk;
        switch (typeof chunk) {
          case "object":
            if (chunk === null) {
              controller.terminate();
            } else if (ArrayBuffer.isView(chunk)) {
              controller.enqueue(
                new Uint8Array(
                  chunk.buffer,
                  chunk.byteOffset,
                  chunk.byteLength,
                ),
              );
            } else if (
              Array.isArray(chunk) &&
              chunk.every((value) => typeof value === "number")
            ) {
              controller.enqueue(new Uint8Array(chunk));
            } else if (
              typeof chunk.valueOf === "function" && chunk.valueOf() !== chunk
            ) {
              this.transform(chunk.valueOf(), controller);
            } else if ("toJSON" in chunk) {
              this.transform(JSON.stringify(chunk), controller);
            }
            break;
          case "symbol":
            controller.error(
              new TypeError("Cannot transform a symbol to a Uint8Array"),
            );
            break;
          case "undefined":
            controller.error(
              new TypeError("Cannot transform undefined to a Uint8Array"),
            );
            break;
          default:
            controller.enqueue(this.encoder.encode(String(chunk)));
        }
      },
      encoder,
    };
    super(init);
  }
}
