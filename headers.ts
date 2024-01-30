// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/** With a provided attribute pattern, return a RegExp which will match and
 * capture in the first group the value of the attribute from a header value. */
export function toParamRegExp(
  attributePattern: string,
  flags?: string,
): RegExp {
  // deno-fmt-ignore
  return new RegExp(
    `(?:^|;)\\s*${attributePattern}\\s*=\\s*` +
    `(` +
      `[^";\\s][^;\\s]*` +
    `|` +
      `"(?:[^"\\\\]|\\\\"?)+"?` +
    `)`,
    flags
  );
}

/** Unquotes attribute values that might be pass as part of a header. */
export function unquote(value: string): string {
  if (value.startsWith(`"`)) {
    const parts = value.slice(1).split(`\\"`);
    for (let i = 0; i < parts.length; ++i) {
      const quoteIndex = parts[i].indexOf(`"`);
      if (quoteIndex !== -1) {
        parts[i] = parts[i].slice(0, quoteIndex);
        parts.length = i + 1; // Truncates and stops the loop
      }
      parts[i] = parts[i].replace(/\\(.)/g, "$1");
    }
    value = parts.join(`"`);
  }
  return value;
}
