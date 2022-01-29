// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

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
  Body,
  BodyBytes,
  BodyForm,
  BodyFormData,
  BodyJson,
  BodyOptions,
  BodyReader,
  BodyStream,
  BodyText,
  BodyType,
  BodyUndefined,
} from "./body.ts";
export { Context } from "./context.ts";
export type { ContextSendOptions } from "./context.ts";
export * as helpers from "./helpers.ts";
export { Cookies } from "./cookies.ts";
export type { CookiesGetOptions, CookiesSetDeleteOptions } from "./cookies.ts";
export * as etag from "./etag.ts";
export { HttpServerNative } from "./http_server_native.ts";
export type { NativeRequest } from "./http_server_native.ts";
export { HttpError, httpErrors, isHttpError } from "./httpError.ts";
export { proxy } from "./middleware/proxy.ts";
export type { ProxyOptions } from "./middleware/proxy.ts";
export { compose as composeMiddleware } from "./middleware.ts";
export type { Middleware } from "./middleware.ts";
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
export { ServerSentEvent } from "./server_sent_event.ts";
export type {
  ServerSentEventInit,
  ServerSentEventTarget,
} from "./server_sent_event.ts";
export * as testing from "./testing.ts";
export type {
  ErrorStatus,
  HTTPMethods,
  RedirectStatus,
  ServerConstructor,
} from "./types.d.ts";
export { isErrorStatus, isRedirectStatus } from "./util.ts";

// Re-exported from `net`
export { Status, STATUS_TEXT } from "./deps.ts";
