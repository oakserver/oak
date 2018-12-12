import { serve } from "./deps";

type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
type UnpackAsyncIterator<T> = T extends AsyncIterableIterator<infer U>
  ? U
  : any;

export type ServerRequest = UnpackAsyncIterator<ReturnType<typeof serve>>;

export class Request {
  private _serverRequest: ServerRequest;

  get method(): string {
    return this._serverRequest.method;
  }

  get url(): string {
    return this._serverRequest.url;
  }

  constructor(serverRequest: ServerRequest) {
    this._serverRequest = serverRequest;
  }
}
