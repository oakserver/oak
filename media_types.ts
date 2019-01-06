import { extname, mimeDB } from "./deps.ts";

const EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
const TEXT_TYPE_REGEXP = /^text\//i;

/** A map of extensions for a given media type */
export const extensions = new Map<string, string[]>();

/** A map of the media type for a given extension */
export const types = new Map<string, string>();

/** Internal function to populate the maps based on the Mime DB */
function populateMaps(
  extensions: Map<string, string[]>,
  types: Map<string, string>
) {
  const preference = ["nginx", "apache", undefined, "iana"];

  for (const type of Object.keys(mimeDB)) {
    const mime = mimeDB[type];
    const exts = mime.extensions;

    if (!exts || !exts.length) {
      continue;
    }

    extensions.set(type, exts);

    for (const ext of exts) {
      if (types.has(ext)) {
        const current = types.get(ext)!;
        const from = preference.indexOf(mimeDB[current].source);
        const to = preference.indexOf(mime.source);

        if (
          current !== "application/octet-stream" &&
          (from > to ||
            (from === to && current.substr(0, 12) === "application/"))
        ) {
          continue;
        }
      }

      types.set(ext, type);
    }
  }
}

// Populate the maps upon module load
populateMaps(extensions, types);

/** Given a media type return any default charset string.  Returns `undefined`
 * if not resolvable.
 */
export function charset(type: string): string | undefined {
  const m = EXTRACT_TYPE_REGEXP.exec(type);
  if (!m) {
    return;
  }
  const [match] = m;
  const mime = mimeDB[match.toLowerCase()];

  if (mime && mime.charset) {
    return mime.charset;
  }

  if (TEXT_TYPE_REGEXP.test(match)) {
    return "UTF-8";
  }
}

/** Given an extension or media type, return the full `Content-Type` header
 * string.  Returns `undefined` if not resolvable.
 */
export function contentType(str: string): string | undefined {
  let mime = str.includes("/") ? str : lookup(str);

  if (!mime) {
    return;
  }

  if (!mime.includes("charset")) {
    const cs = charset(mime);
    if (cs) {
      mime += `; charset=${cs.toLowerCase()}`;
    }
  }

  return mime;
}

/** Given a media type, return the most appropriate extension or return
 * `undefined` if there is none.
 */
export function extension(type: string): string | undefined {
  const match = EXTRACT_TYPE_REGEXP.exec(type);

  if (!match) {
    return;
  }

  const exts = extensions.get(match[1].toLowerCase());

  if (!exts || !exts.length) {
    return;
  }

  return exts[0];
}

/** Given an extension, lookup the appropriate media type for that extension.
 * Likely you should be using `contentType()` though instead.
 */
export function lookup(path: string): string | undefined {
  const extension = extname("x." + path)
    .toLowerCase()
    .substr(1);

  return types.get(extension);
}
