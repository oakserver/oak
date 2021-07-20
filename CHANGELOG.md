# oak Change Log

## Version 8.0.0

- **BREAKING CHANGE** feat: add native request web socket support (9d1b770)

  The ability to upgrade Deno native HTTP requests is support by Deno 1.12 and
  later and has been integrated into oak.

  This also introduces a **breaking change**, where if using the `std` server
  with oak, the `ctx.upgrade()` will resolve with a web standard `WebSocket`
  interface, where previously it resolved with the non-standard `std` server
  interface.

- **BREAKING CHANGE** feat: options for the way state is create for a context
  (f360e3f)

  In oak v6 and prior, the context's `.state` was simply an alias to the
  application's `.state`. In v7, the context's `.state` was a clone of the
  application's `.state`. The problem was that not everything that could be
  assigned to the application's state was cloneable, leading to runtime errors
  when trying to handle requests.

  In v8, the default behavior is similar to v7, but non-clone-able properties of
  the applications `.state` are skipped. In addition, there is a new application
  option which can be passed up creating a new application named `contextState`
  which takes one of several values:

  - `"clone"` - this is the default behavior mentioned above.
  - `"alias"` - this is the behavior of oak v6 and prior, where the
    application's `.state` strictly equals the context's `.state`.
  - `"prototype"` - this creates a new `.state` for each context, using the
    application's `.state` as the prototype.
  - `"empty"` - a new empty object is created for each context's `.state`.

- feat: allow setting of an extension/content type map for send() (f8ee902)

  `send()` takes a new option of `contextTypes` which is a record of extensions
  and content types to use. This allows extending and overriding of the existing
  `media_types` database when serving files.

- feat: log uncaught errors by default (7669d12)

  While the application has emitted `"error"` events for quite a while, many
  users are not aware of how listen for errors. Therefore by default, the
  application will log to stderr any uncaught errors that occur within the
  application. This behavior can be turned off by setting the application option
  `logErrors` to `false` when creating a new application.

- fix(#352): fix content-length in Range requests (#353)

- fix(#362): handle errors occurring during finalizing response (7d39e1f)

  Previously, if there were issues finalizing the response, such as attempting
  to serialize to JSON the response's body, the error would be dispatched on the
  application, but a response would not be sent back to the client, just
  "hanging" the client. Now, an error response (500) should be sent back to the
  client.

- docs: update readme (6efacb1)
- chore: update to Deno 1.12.1, std 0.102.0, media_types 2.9.3 (4bc080c)
- chore: update vscode settings (f4138f9)

## Version 7.7.0

- feat: improve inspection/console logging (bfbf061)

  Most oak classes now utilise Deno's custom inspect API to provide better
  logging information.

- feat: SSE can send keep-alive comments (3d27096)

  When upgrading a connection to a server-sent-event target, the `keepAlive`
  option can be set to allow "polling" of the connection to keep it alive (as
  well as detect client disconnections without having to dispatch and event).

- fix(proxy): Retain original search parameters (#347)

  Search parameters in a proxied request are now forwarded.

- fix(#343): parse out unique set-cookie headers

  When setting multiple cookies in a response, adding additional cookies works
  properly.

- fix: SSEStreamTarget handles connections closing properly (0678104)

  When using SSE with the native HTTP, client connections closing will now
  trigger the `"close"` event properly.

- chore: change ci to Deno 1.11.2 (bbd5fe4)
- chore: restore lint comments until Deno 1.12 (93323c3)

## Version 7.6.3

- fix: type check under other targets (6fdb123)
- fix: formatting (e51751c)
- docs: correct typo (#342)

## Version 7.6.2

- feat: proxy supports content type callback (d471d1d)

## Version 7.6.1

- fix: handleError works correctly under Deploy (0d929ea)

## Version 7.6.0

- feat: improve support for Deno Deploy (2426ff2)

  Fix issues with parsing certain request fields when running under deploy.

- feat: add testing utilities (7baf73c)

  Add utilities for make testing oak middleware easier. See
  [Testing oak](https://oakserver.github.io/oak/testing) for more information.

- feat: proxy middleware (bbc7ab7)

  Add built in proxy middleware that makes it easier to do back to back proxy
  requests using Deno CLI or Deno Deploy.

- fix(#328): use Referer instead of Referrer header (a9c56c7)
- fix(#335): remove extra CRLF in multipart (#338)
- fix(#333): if proxy is true, then parse headers for url (9a628e3)
- fix(#327): properly handle setting multiple cookies (275fe08)
- tests: fix response test fixture (5d66aa1)
- tests: async try catch throws (b6288d6)
- chore: refactor based on canary Deno updating to TS 4.3 (43d2699)
- chore: incorporate upcoming Deno changes (7a69a57)
- chore: update to Deno 1.11.1, std 0.99.0, media_types 2.9.0 (d9e5387)

## Version 7.5.0

- feat: allow overriding std/native HTTP servers (771e7b0)

  Exported `HttpSeverStd` and `HttpServerNative` to allow these to be supplied
  when creating the application by passing the `serverConstructor` option, as
  well as updated documentation around how to accomplish this.

- fix(#282): `router.redirect()` destination can be arbitrary URL (802435c)
- fix(#319): ensure that at least one middleware is present in types (29326ef)
- fix: upcoming TypeScript 4.3 changes (fe7ad3c)
- docs: add information about Deno Deploy (3faadda)

## Version 7.4.1

- chore: update to Deno 1.10.1, std 0.96.0, media_types 2.8.4

## Version 7.4.0

- feat: add range support for send() (#303)

  When using `.send()` oak announces support for ranges and is able to process
  the `Range` header along with `If-Range` header.

- feat: add support for nested routers (#275)

  Routers can now support "sub" or nested routers.

- fix: properly close native listener (a7e053c)
- fix: handle http connection errors (6d5f6d6)
- fix: `context.app.state` is properly typed (81fcefa)
- fix: setting response body to `null` or `undefined` returns 204 (af21480)
- fix: no response body is `null` or `undefined`, not falsy (1481508)
- refactor: allow non-void returns from middleware (b86f1da)
- chore: restore Deno 1.9.1 to CI (9696760)
- chore: Deno fmt updates (8398d6e)
- chore: add example nested routing server (0d4b5d8)

## Version 7.3.0

- feat: better handling of readable streams in response body (#301)

  Before, streams set as a body would always be assumed to be an Uint8Array
  readable stream. Now any readable stream set as the response body will be
  transformed automatically to an Uint8Array. In addition, when using the
  `std/http` version, readable streams were treated as async iterators, now they
  will be directly converted into a `Deno.Reader`.

- fix: Deno 1.9.1 breaking changes (2527604)
- fix: Deno 1.9.1 changes to native HTTP (0b8a7d8)
- fix: better support for native HTTPS (e6d3e72)
- chore: fix test cases for native request (8490b6f)
- chore: update to Deno 1.9.1, std 0.94.0, media_types 2.8.2 (78c0997)
- chore: revert to canary in CI until 1.9.1 available as action

## Version 7.2.0

Because one minor release a day isn't good enough and:

- feat: add app.fetchEventHandler() (#296)

  Add a method which provides everything needed for handling Deno Deploy's
  `FetchEvent`s.

## Version 7.1.0

- feat: enable server-sent events for native HTTP bindings (#293)

  Server-sent events now work on both the `std/http` and the native HTTP server
  with Deno.

- refactor: make connection optional for app.handle() (#294)

  This was required to support Deno Deploy.

- refactor: add fallback for structured clone when core unavailable (#295)

  This was also required to support Deno Deploy, as it currently doesn't expose
  the low level APIs required to do structured cloning.

## Version 7.0.0

- feat: context.state is cloned from app.state (1590ac9)

  This is also a **breaking change,** but in a way that is consistent with
  general expectations about how state works, in that `Context::state` is no
  longer global.

- feat: add etag support (2a38d15)

  The `etag.ts` module provides middleware and other tools to support `ETag`s.

- feat: `.send()` supports ETag and If-None-Match automatically (be80283)

  Using `.send()` to send files in responses will automatically handle setting
  and validating `ETag`s from clients to deal with determining if files have
  changed.

- feat: Support Deno's native HTTP server (59e7a00)

  As of Deno 1.9.0, Deno supports a _native_ HTTP server and now oak supports
  both the `std/http` server and the native one. It does this transparently to
  the user, so if the new native APIs are available, they will be used.

  Currently to have the APIs available, you have to start Deno with the
  `--unstable` flag.

- refactor: support native HTTP request on request body (96373ac)

  Using the `Request::body` is fully supported with the native HTTP server and
  because of this the request body type of `"stream"` is supported, which will
  return the body as a `ReadableStream<Uint8Array>`.

  This also makes a **breaking change** where the `"raw"` body type was renamed
  `"bytes"` to better reflect what is occurring.

  This also works around an issue with Deno where when reading the response
  body, the response fails.

- refactor: minor refactors and removal of deprecated Deno APIs (993efa7)
- chore: remove unused import (33f7463)
- chore: remove unused lint rule (0ff0574)
- chore: chore: update to Deno 1.9.0, std 0.93.0, media_types 2.8.1 (ac5c426)

## Version 6.5.1

- chore: Update to Deno 1.8.3, std 0.92.0, media_types 2.8.0
- chore: add code coverage and badge to README
- chore: migrate CI to official Deno actions
- docs: minor type fixes
- docs: add this CHANGELOG
