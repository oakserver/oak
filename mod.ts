// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.

/**
 * A middleware framework for handling HTTP with Deno.
 *
 * oak works well on both Deno CLI and Deno deploy, and is inspired by
 * [koa](https://koajs.com/). It works well with both the Deno CLI and
 * [Deno Deploy](https://deno.com/deploy).
 *
 * ### Example server
 *
 * A minimal router server which responds with content on `/`. With Deno CLI
 * this will listen on port 8080 and on Deploy, this will simply serve requests
 * received on the application.
 *
 * ```ts
 * import { Application, Router } from "https://deno.land/x/oak/mod.ts";
 *
 * const router = new Router();
 * router.get("/", (ctx) => {
 *   ctx.response.body = `<!DOCTYPE html>
 *     <html>
 *       <head><title>Hello oak!</title><head>
 *       <body>
 *         <h1>Hello oak!</h1>
 *       </body>
 *     </html>
 *   `;
 * });
 *
 * const app = new Application();
 * app.use(router.routes());
 * app.use(router.allowedMethods());
 *
 * app.listen({ port: 8080 });
 * ```
 *
 * @module
 */

export { Application } from "./application.ts";
export type {
  ApplicationOptions,
  ListenOptions,
  ListenOptionsBase,
  ListenOptionsTls,
  State,
} from "./application.ts";
export type {
  BodyBytes,
  BodyContentTypes,
  BodyForm,
  BodyFormData,
  BodyJson,
  BodyOptions,
  BodyOptionsContentTypes,
  BodyReader,
  BodyStream,
  BodyText,
  BodyType,
  BodyUndefined,
} from "./body.ts";
export { Context, type ContextSendOptions } from "./context.ts";
export * as helpers from "./helpers.ts";
export * as etag from "./etag.ts";
export { HttpServer as HttpServerNative } from "./http_server_native.ts";
export { type NativeRequest } from "./http_server_native_request.ts";
export { proxy } from "./middleware/proxy.ts";
export type { ProxyOptions } from "./middleware/proxy.ts";
export { compose as composeMiddleware } from "./middleware.ts";
export type {
  Middleware,
  MiddlewareObject,
  MiddlewareOrMiddlewareObject,
  Next,
} from "./middleware.ts";
export { FormDataReader } from "./multipart.ts";
export type {
  FormDataBody,
  FormDataFile,
  FormDataReadOptions,
} from "./multipart.ts";
export { ifRange, MultiPartStream, parseRange } from "./range.ts";
export type { ByteRange } from "./range.ts";
export { Request } from "./request.ts";
export { REDIRECT_BACK, Response } from "./response.ts";
export { Router } from "./router.ts";
export type {
  Route,
  RouteParams,
  RouterAllowedMethodsOptions,
  RouterContext,
  RouterMiddleware,
  RouterOptions,
  RouterParamMiddleware,
} from "./router.ts";
export { send } from "./send.ts";
export type { SendOptions } from "./send.ts";
/** Utilities for making testing oak servers easier. */
export * as testing from "./testing.ts";
export type { ServerConstructor } from "./types.d.ts";

// Re-exported from `std/http`
export {
  createHttpError,
  errors as httpErrors,
  type ErrorStatus,
  HttpError,
  type HTTPMethods,
  isErrorStatus,
  isHttpError,
  isRedirectStatus,
  type RedirectStatus,
  SecureCookieMap as Cookies,
  type SecureCookieMapGetOptions as CookiesGetOptions,
  type SecureCookieMapSetDeleteOptions as CookiesSetDeleteOptions,
  ServerSentEvent,
  type ServerSentEventInit,
  type ServerSentEventTarget,
  Status,
  STATUS_TEXT,
} from "./deps.ts";
