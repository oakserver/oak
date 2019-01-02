import { serve } from "./deps.ts";
import { HTTPMethods } from "./types.ts";

type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
type UnpackAsyncIterator<T> = T extends AsyncIterableIterator<infer U>
  ? U
  : any;

export type ServerRequest = UnpackAsyncIterator<ReturnType<typeof serve>>;

export class Request {
  private _path: string;
  private _search?: string;
  private _searchParams: URLSearchParams;
  private _serverRequest: ServerRequest;

  get headers(): Headers {
    return this._serverRequest.headers;
  }

  get method(): HTTPMethods {
    return this._serverRequest.method as HTTPMethods;
  }

  get path(): string {
    return this._path;
  }

  get search(): string | undefined {
    return this._search;
  }

  get searchParams(): URLSearchParams {
    return this._searchParams;
  }

  get url(): string {
    return this._serverRequest.url;
  }

  constructor(serverRequest: ServerRequest) {
    this._serverRequest = serverRequest;
    const [path, search] = serverRequest.url.split("?");
    this._path = path;
    this._search = search ? `?${search}` : undefined;
    this._searchParams = new URLSearchParams(search);
  }
}
