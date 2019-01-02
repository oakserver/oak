import { Status } from "./deps.ts";

interface ServerResponse {
  status?: number;
  headers?: Headers;
  body?: Uint8Array;
}

function isHtml(value: string): boolean {
  return /^\s*<(?:!DOCTYPE|html|body)/i.test(value);
}

export class Response {
  private _encoder = new TextEncoder();

  status?: Status;
  body?: any;
  headers = new Headers();

  private _setContentType(contentType: string) {
    if (!this.headers.has("content-type")) {
      this.headers.append("conent-type", contentType);
    }
  }

  fromResponse(response: Response) {
    Object.assign(this, response);
  }

  toServerResponse(): ServerResponse {
    let body: Uint8Array | undefined;
    const typeofBody = typeof this.body;
    if (
      ["string", "number", "bigint", "boolean", "symbol"].includes(typeofBody)
    ) {
      const bodyText = String(this.body);
      body = this._encoder.encode(bodyText);
      this._setContentType(isHtml(bodyText) ? "text/html" : "text/plain");
    } else if (
      typeofBody === "object" &&
      this.body !== null &&
      !(this.body instanceof Uint8Array)
    ) {
      body = this._encoder.encode(JSON.stringify(this.body));
      this._setContentType("application/json");
    } else if (this.body instanceof Uint8Array) {
      body = this.body;
    }
    return {
      status: this.status || (body ? Status.OK : Status.NotFound),
      body,
      headers: this.headers
    };
  }
}
