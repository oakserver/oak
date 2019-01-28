/*!
 * Adapted directly from media-typer at https://github.com/jshttp/media-typer/
 * which is licensed as follows:
 *
 * media-typer
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

const SUBTYPE_NAME_REGEXP = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.-]{0,126}$/;
const TYPE_NAME_REGEXP = /^[A-Za-z0-9][A-Za-z0-9!#$&^_-]{0,126}$/;
const TYPE_REGEXP = /^ *([A-Za-z0-9][A-Za-z0-9!#$&^_-]{0,126})\/([A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}) *$/;

class MediaType {
  constructor(
    public type: string,
    public subtype: string,
    public suffix?: string
  ) {}
}

export function format(obj: MediaType): string {
  const { subtype, suffix, type } = obj;

  if (!TYPE_NAME_REGEXP.test(type)) {
    throw new TypeError("Invalid type.");
  }
  if (!SUBTYPE_NAME_REGEXP.test(subtype)) {
    throw new TypeError("Invalid subtype.");
  }

  let str = `${type}/${subtype}`;

  if (suffix) {
    if (!TYPE_NAME_REGEXP.test(suffix)) {
      throw new TypeError("Invalid suffix.");
    }

    str += `+${suffix}`;
  }

  return str;
}

export function parse(str: string): MediaType {
  const match = TYPE_REGEXP.exec(str.toLowerCase());

  if (!match) {
    throw new TypeError("Invalid media type.");
  }

  let [, type, subtype] = match;
  let suffix: string | undefined;

  const idx = subtype.lastIndexOf("+");
  if (idx !== -1) {
    suffix = subtype.substr(idx + 1);
    subtype = subtype.substr(0, idx);
  }

  return new MediaType(type, subtype, suffix);
}
