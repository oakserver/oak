// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

import { createHttpError } from "../deps.ts";

/**
 * Safely decode a URI component, where if it fails, instead of throwing,
 * just returns the original string
 */
export function decode(pathname: string): string {
  try {
    return decodeURI(pathname);
  } catch (err) {
    if (err instanceof URIError) {
      throw createHttpError(400, "Failed to decode URI", { expose: false });
    }
    throw err;
  }
}
