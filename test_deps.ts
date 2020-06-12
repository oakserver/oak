// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

export const test = Deno.test;

export { BufReader, BufWriter } from "https://deno.land/std@0.57.0/io/bufio.ts";
export { StringReader } from "https://deno.land/std@0.57.0/io/readers.ts";
export { StringWriter } from "https://deno.land/std@0.57.0/io/writers.ts";
export {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
  assertThrowsAsync,
} from "https://deno.land/std@0.57.0/testing/asserts.ts";
