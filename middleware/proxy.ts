// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

import type { State } from "../application.ts";
import type { Context } from "../context.ts";
import type { Middleware } from "../middleware.ts";
import type {
  RouteParams,
  RouterContext,
  RouterMiddleware,
} from "../router.ts";
import { isRouterContext } from "../util.ts";

export type Fetch = (input: Request) => Promise<Response>;

export type ProxyMatchFunction<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  // deno-lint-ignore no-explicit-any
  S extends State = Record<string, any>,
> = (ctx: Context<S> | RouterContext<R, P, S>) => boolean;

export type ProxyMapFunction<R extends string, P extends RouteParams<R>> = (
  path: R,
  params?: P,
) => R;

export type ProxyHeadersFunction<S extends State> = (
  ctx: Context<S>,
) => HeadersInit | Promise<HeadersInit>;

export type ProxyRouterHeadersFunction<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
> = (ctx: RouterContext<R, P, S>) => HeadersInit | Promise<HeadersInit>;

export interface ProxyOptions<
  R extends string,
  P extends RouteParams<R> = RouteParams<R>,
  // deno-lint-ignore no-explicit-any
  S extends State = Record<string, any>,
> {
  /** A callback hook that is called after the response is received which allows
   * the response content type to be adjusted. This is for situations where the
   * content type provided by the proxy server might not be suitable for
   * responding with. */
  contentType?(
    url: string,
    contentType?: string,
  ): Promise<string | undefined> | string | undefined;
  /** The fetch function to use to proxy the request. This defaults to the
   * global `fetch` function. This is designed for test mocking purposes. */
  fetch?: Fetch;
  /** Additional headers that should be set in the response. The value can
   * be a headers init value or a function that returns or resolves with a
   * headers init value. */
  headers?:
    | HeadersInit
    | ProxyHeadersFunction<S>
    | ProxyRouterHeadersFunction<R, P, S>;
  /** Either a record or a proxy map function that will allow proxied requests
   * being handled by the middleware to be remapped to a different remote
   * path. */
  map?: Record<string, R> | ProxyMapFunction<R, P>;
  /** A string, regular expression or proxy match function what determines if
   * the proxy middleware should proxy the request.
   *
   * If the value is a string the match will be true if the requests pathname
   * starts with the string. In the case of a regular expression, if the
   * pathname
   */
  match?:
    | string
    | RegExp
    | ProxyMatchFunction<R, P, S>;
  /** A flag that indicates if traditional proxy headers should be set in the
   * response. This defaults to `true`.
   */
  proxyHeaders?: boolean;
  /** A callback hook which will be called before each proxied fetch request
   * to allow the native `Request` to be modified or replaced. */
  request?(req: Request): Request | Promise<Request>;
  /** A callback hook which will be called after each proxied fetch response
   * is received to allow the native `Response` to be modified or replaced. */
  response?(res: Response): Response | Promise<Response>;
}

const FORWARDED_RE =
  /^(,[ \\t]*)*([!#$%&'*+.^_`|~0-9A-Za-z-]+=([!#$%&'*+.^_`|~0-9A-Za-z-]+|\"([\\t \\x21\\x23-\\x5B\\x5D-\\x7E\\x80-\\xFF]|\\\\[\\t \\x21-\\x7E\\x80-\\xFF])*\"))?(;([!#$%&'*+.^_`|~0-9A-Za-z-]+=([!#$%&'*+.^_`|~0-9A-Za-z-]+|\"([\\t \\x21\\x23-\\x5B\\x5D-\\x7E\\x80-\\xFF]|\\\\[\\t \\x21-\\x7E\\x80-\\xFF])*\"))?)*([ \\t]*,([ \\t]*([!#$%&'*+.^_`|~0-9A-Za-z-]+=([!#$%&'*+.^_`|~0-9A-Za-z-]+|\"([\\t \\x21\\x23-\\x5B\\x5D-\\x7E\\x80-\\xFF]|\\\\[\\t \\x21-\\x7E\\x80-\\xFF])*\"))?(;([!#$%&'*+.^_`|~0-9A-Za-z-]+=([!#$%&'*+.^_`|~0-9A-Za-z-]+|\"([\\t \\x21\\x23-\\x5B\\x5D-\\x7E\\x80-\\xFF]|\\\\[\\t \\x21-\\x7E\\x80-\\xFF])*\"))?)*)?)*$/;

function createMatcher<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(
  { match }: ProxyOptions<R, P, S>,
) {
  return function matches(ctx: RouterContext<R, P, S>): boolean {
    if (!match) {
      return true;
    }
    if (typeof match === "string") {
      return ctx.request.url.pathname.startsWith(match);
    }
    if (match instanceof RegExp) {
      return match.test(ctx.request.url.pathname);
    }
    return match(ctx);
  };
}

async function createRequest<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(
  target: string | URL,
  ctx: Context<S> | RouterContext<R, P, S>,
  { headers: optHeaders, map, proxyHeaders = true, request: reqFn }:
    ProxyOptions<R, P, S>,
): Promise<Request> {
  let path = ctx.request.url.pathname as R;
  let params: P | undefined;
  if (isRouterContext<R, P, S>(ctx)) {
    params = ctx.params;
  }
  if (map && typeof map === "function") {
    path = map(path, params);
  } else if (map) {
    path = map[path] ?? path;
  }
  const url = new URL(String(target));
  if (url.pathname.endsWith("/") && path.startsWith("/")) {
    url.pathname = `${url.pathname}${path.slice(1)}`;
  } else if (!url.pathname.endsWith("/") && !path.startsWith("/")) {
    url.pathname = `${url.pathname}/${path}`;
  } else {
    url.pathname = `${url.pathname}${path}`;
  }
  url.search = ctx.request.url.search;

  const body = getBodyInit(ctx);
  const headers = new Headers(ctx.request.headers);
  if (optHeaders) {
    if (typeof optHeaders === "function") {
      optHeaders = await optHeaders(ctx as RouterContext<R, P, S>);
    }
    for (const [key, value] of iterableHeaders(optHeaders)) {
      headers.set(key, value);
    }
  }
  if (proxyHeaders) {
    const maybeForwarded = headers.get("forwarded");
    const ip = ctx.request.ip.startsWith("[")
      ? `"${ctx.request.ip}"`
      : ctx.request.ip;
    const host = headers.get("host");
    if (maybeForwarded && FORWARDED_RE.test(maybeForwarded)) {
      let value = `for=${ip}`;
      if (host) {
        value += `;host=${host}`;
      }
      headers.append("forwarded", value);
    } else {
      headers.append("x-forwarded-for", ip);
      if (host) {
        headers.append("x-forwarded-host", host);
      }
    }
  }

  const init: RequestInit = {
    body,
    headers,
    method: ctx.request.method,
    redirect: "follow",
  };
  let request = new Request(url.toString(), init);
  if (reqFn) {
    request = await reqFn(request);
  }
  return request;
}

function getBodyInit<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(
  ctx: Context<S> | RouterContext<R, P, S>,
): BodyInit | null {
  if (!ctx.request.hasBody) {
    return null;
  }
  return ctx.request.body({ type: "stream" }).value;
}

function iterableHeaders(
  headers: HeadersInit,
): IterableIterator<[string, string]> {
  if (headers instanceof Headers) {
    return headers.entries();
  } else if (Array.isArray(headers)) {
    return headers.values() as IterableIterator<[string, string]>;
  } else {
    return Object.entries(headers).values();
  }
}

async function processResponse<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(
  response: Response,
  ctx: Context<S> | RouterContext<R, P, S>,
  { contentType: contentTypeFn, response: resFn }: ProxyOptions<R, P, S>,
) {
  if (resFn) {
    response = await resFn(response);
  }
  if (response.body) {
    ctx.response.body = response.body;
  } else {
    ctx.response.body = null;
  }
  ctx.response.status = response.status;
  for (const [key, value] of response.headers) {
    ctx.response.headers.append(key, value);
  }
  if (contentTypeFn) {
    const value = await contentTypeFn(
      response.url,
      ctx.response.headers.get("content-type") ?? undefined,
    );
    if (value != null) {
      ctx.response.headers.set("content-type", value);
    }
  }
}

/**
 * Middleware that provides a back-to-back proxy for requests.
 *
 * @param target
 * @param options
 */
export function proxy<S extends State>(
  target: string | URL,
  options?: ProxyOptions<string, RouteParams<string>, S>,
): Middleware<S>;
export function proxy<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(
  target: string | URL,
  options: ProxyOptions<R, P, S> = {},
): RouterMiddleware<R, P, S> {
  const matches = createMatcher(options);
  return async function proxy(ctx, next) {
    if (!matches(ctx)) {
      return next();
    }
    const request = await createRequest(target, ctx, options);
    const { fetch = globalThis.fetch } = options;
    const response = await fetch(request);
    await processResponse(response, ctx, options);
    return next();
  };
}
