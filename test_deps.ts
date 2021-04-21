// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.

export const { test } = Deno;

export { Buffer } from "https://deno.land/std@0.94.0/io/buffer.ts";
export { BufReader, BufWriter } from "https://deno.land/std@0.94.0/io/bufio.ts";
export { StringReader } from "https://deno.land/std@0.94.0/io/readers.ts";
export { StringWriter } from "https://deno.land/std@0.94.0/io/writers.ts";
export { writeAllSync } from "https://deno.land/std@0.94.0/io/util.ts";
export {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
  assertThrowsAsync,
} from "https://deno.land/std@0.94.0/testing/asserts.ts";
