// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

/**
 * A middleware framework for handling HTTP with [Deno CLI](https://deno.land),
 * [Deno Deploy](https://deno.com/deploy),
 * [Cloudflare Workers](https://workers.cloudflare.com/),
 * [Node.js](https://nodejs.org/), and [Bun](https://bun.sh/).
 *
 * oak is inspired by [koa](https://koajs.com/).
 *
 * ## Example server
 *
 * A minimal router server which responds with content on `/`.
 *
 * ### Deno CLI and Deno Deploy
 *
 * ```ts
 * import { Application } from "jsr:@oak/oak/application";
 * import { Router } from "jsr:@oak/oak/router";
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
 * ### Node.js and Bun
 *
 * You will have to install the package and then:
 *
 * ```ts
 * import { Application } from "@oak/oak/application";
 * import { Router } from "@oak/oak/router";
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
 * ### Cloudflare Workers
 *
 * You will have to install the package and then:
 *
 * ```ts
 * import { Application } from "@oak/oak/application";
 * import { Router } from "@oak/oak/router";
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
 * export default { fetch: app.fetch };
 * ```
 *
 * @module
 */

export {
  Application,
  type ApplicationOptions,
  type ListenOptions,
  type ListenOptionsBase,
  type ListenOptionsTls,
  type State,
} from "./application.ts";
export type { BodyType } from "./body.ts";
export { Context, type ContextSendOptions } from "./context.ts";
export { Server as HttpServerNative } from "./http_server_native.ts";
export { type NativeRequest } from "./http_server_native_request.ts";
export * as etag from "./middleware/etag.ts";
export { proxy, type ProxyOptions } from "./middleware/proxy.ts";
export {
  route,
  RouteContext,
  serve,
  ServeContext,
} from "./middleware/serve.ts";
export {
  compose as composeMiddleware,
  type Middleware,
  type MiddlewareObject,
  type MiddlewareOrMiddlewareObject,
  type Next,
} from "./middleware.ts";
export { Request } from "./request.ts";
export { REDIRECT_BACK, Response } from "./response.ts";
export {
  type Route,
  type RouteParams,
  Router,
  type RouterAllowedMethodsOptions,
  type RouterContext,
  type RouterMiddleware,
  type RouterOptions,
  type RouterParamMiddleware,
} from "./router.ts";
export { send, type SendOptions } from "./send.ts";
/** Utilities for making testing oak servers easier. */
export * as testing from "./testing.ts";
export { type ServerConstructor } from "./types.ts";

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
