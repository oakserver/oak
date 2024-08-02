// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/**
 * Safely decode a URI component, where if it fails, instead of throwing,
 * just returns the original string
 */
export function decodeComponent(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
