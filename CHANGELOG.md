# oak Change Log

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
