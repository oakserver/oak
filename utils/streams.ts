// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { BODY_TYPES } from "./consts.ts";

interface Reader {
  read(p: Uint8Array): Promise<number | null>;
}

interface Closer {
  close(): void;
}

interface ReadableStreamFromReaderOptions {
  /** If the `reader` is also a `Closer`, automatically close the `reader`
   * when `EOF` is encountered, or a read error occurs.
   *
   * Defaults to `true`. */
  autoClose?: boolean;

  /** The size of chunks to allocate to read, the default is ~16KiB, which is
   * the maximum size that Deno operations can currently support. */
  chunkSize?: number;

  /** The queuing strategy to create the `ReadableStream` with. */
  strategy?: { highWaterMark?: number | undefined; size?: undefined };
}

function isCloser(value: unknown): value is Deno.Closer {
  return typeof value === "object" && value != null && "close" in value &&
    // deno-lint-ignore no-explicit-any
    typeof (value as Record<string, any>)["close"] === "function";
}

const DEFAULT_CHUNK_SIZE = 16_640; // 17 Kib

const encoder = new TextEncoder();

/**
 * Create a `ReadableStream<Uint8Array>` from a `Reader`.
 *
 * When the pull algorithm is called on the stream, a chunk from the reader
 * will be read.  When `null` is returned from the reader, the stream will be
 * closed along with the reader (if it is also a `Closer`).
 */
export function readableStreamFromReader(
  reader: Reader | (Reader & Closer),
  options: ReadableStreamFromReaderOptions = {},
): ReadableStream<Uint8Array> {
  const {
    autoClose = true,
    chunkSize = DEFAULT_CHUNK_SIZE,
    strategy,
  } = options;

  return new ReadableStream({
    async pull(controller) {
      const chunk = new Uint8Array(chunkSize);
      try {
        const read = await reader.read(chunk);
        if (read === null) {
          if (isCloser(reader) && autoClose) {
            reader.close();
          }
          controller.close();
          return;
        }
        controller.enqueue(chunk.subarray(0, read));
      } catch (e) {
        controller.error(e);
        if (isCloser(reader)) {
          reader.close();
        }
      }
    },
    cancel() {
      if (isCloser(reader) && autoClose) {
        reader.close();
      }
    },
  }, strategy);
}

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
