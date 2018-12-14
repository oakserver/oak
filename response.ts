import { Status } from "./deps";

interface ServerResponse {
  status?: number;
  headers?: Headers;
  body?: Uint8Array;
}

export class Response {
  status?: Status;
  body?: any;
  headers = new Headers();

  fromResponse(response: Response) {
    Object.assign(this, response);
  }

  toServerResponse(): ServerResponse {
    const body = this.body && typeof this.body === "string" ? this.body : "";
    return {
      status: this.status,
      body: new TextEncoder().encode(body),
      headers: this.headers
    };
  }
}
