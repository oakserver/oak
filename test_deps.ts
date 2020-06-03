// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

export const test = Deno.test;

export { BufReader, BufWriter } from "https://deno.land/std@0.56.0/io/bufio.ts";
export {
  assert,
  assertEquals,
  assertStrictEq,
  assertThrows,
  assertThrowsAsync,
} from "https://deno.land/std@0.56.0/testing/asserts.ts";
