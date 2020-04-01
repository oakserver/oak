import {
  ServerRequest,
  Response,
  getCookies,
  setCookie,
  delCookie,
  Cookies,
  Cookie
} from "./deps.ts";

export default class CookieHandler {
  _cookies: Cookies;
  _response: Response;

  constructor(request: ServerRequest, response: Response) {
    this._cookies = getCookies(request);
    this._response = response;
  }

  get(name: string): string | undefined {
    return this._cookies[name];
  }

  set(cookie: Cookie) {
    setCookie(this._response, cookie);
  }

  del(name: string) {
    delCookie(this._response, name);
  }
}
