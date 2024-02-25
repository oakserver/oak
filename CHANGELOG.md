# oak Change Log

## Version 14.0.0

- feat: send events immediately sends response to client (a3f0076)

  **BREAKING CHANGE** Previous versions of oak would return a
  `ServerSentEventTarget` when calling `.sendEvents()` on the context, but would
  not send the response to the client until all the middleware completed
  processing. Now, the response is sent back to the client immediately (like the
  websocket `.upgrade()` method) which results in the `ServerSentEventTarget`
  being returned in a promise and also preventing any further changes to
  response by other middleware.

  This has the benefit of meaning any events dispatched from within the main
  flow of the current middleware are sent to the client straight away instead of
  appearing to be buffered.

- fix: http_server_native when closing with signal abort event (#639)
- chore: update to std 0.217.0 (bc88315)

## Version 13.2.5

- fix: wrong file dynamically imported (#638)
- fix: tag server constructors (120a024)
- refactor: move to std assert (f8ab89e)
- chore: update to std 0.215.0 (5b45806)
- chore: update oak commons (151c6bd)

## Version 13.2.4

- fix: more global namespace fixes for node (f1b7d46)

## Version 13.2.3

- fix: shim more globals for node (d879951)

## Version 13.2.2

- fix: handle accessing Deno namespace better (4150b36)

## Version 13.2.1

- fix: don't access Deno namespace unguarded (5b49419)

## Version 13.2.0

- feat: use dynamic imports for node compat (db116d1)

  Instead of depending on dnt to swap out modules for Node compatibility, there
  is a single codebase which dynamically imports modules based on runtime
  detection of the environment.

- fix: fast check fixes (c6db0ac)
- docs: update README badges (aafc571)
- docs: fix typo in README badge (af7dc72)
- chore: update https server example (#637)
- chore: update github actions (44ddcbf)

## Version 13.1.0

- feat: make interop with Fetch API easier (4d4034b)

  For code designed to work with the Fetch API's `Request` and `Response` (like
  `Deno.serve()`) there are now several features that make interop easier. There
  is now the `serve()` and `route()` middleware which will wrap a handler
  function to operate with oak.

- fix: don't set content-type on body FormData (2e2f5da)

  This was causing the boundary to not be set when responding with a `FormData`
  body and therefore making the browser unable to decode the body.

- refactor: migrate to oak commons for media type utils (b075f2e)
- refactor: migrate from .d.ts to .ts for type information (e3fcbcb)
- tests: bulk refactor (81c81fe)
- chore: update copyright dates (436577a)
- chore: integrate import map into deno config (3d328cf)
- docs: fix typo in README (567245e)

## Version 13.0.1

- fix: explicit typings for body (43bcd82)
- fix: add type to body blob (b74b374)
- chore: update to oak commons 0.5.2 (25d82e1)
- docs: document body API in README (43de84a)

## Version 13.0.0

- feat: align request body better to Fetch API (bb996fe)

  **BREAKING CHANGE** Previous versions of oak had a request body API that was
  fairly convoluted as oak evolved from the early days of Deno where there
  wasn't a built in APIs for handling HTTP requests. The Fetch API `Request` and
  `Response` have become the standard almost everywhere and make it easy to get
  ahold of a request body in many forms.

  Inspired by this the `ctx.request.body` aligns to this API for the most part,
  but also still retains some of the advantages that oak provided like providing
  a `ctx.request.body.type` to help figure out what sort of body you are looking
  at as well as support for `ctx.request.body.form()`.

  This also leverages native Fetch API where possible which resolved a lot of
  issues with decoding multi-part forms. This does mean files that are uploaded
  to oak become web standard `File`s that are entries in `FormData`. This means
  `multipart.ts` has been removed from oak and the

- refactor: use Deno.serve() instead of Deno.serveHttp() (bbae544)

  **BREAKING CHANGE** As of Deno 1.40.0, `Deno.serveHttp()` is deprecated and
  will be removed in Deno 2.0. The Deno implementation of oak finally migrates
  to `Deno.serve()`. While this should be transparent in most cases, it has
  changed some of the options that can be used when using `app.listen()` to
  align to the `Deno.serve()` options. Also, unlike unstable `Deno.serverHttp()`
  `Deno.serve()` doesn't support HTTP/2, therefore it isn't currently possible
  to support HTTP/2 in oak.

- fix: remove deprecated API, work around Deno bug (71a1d92)

  There were a few other APIs that were deprecated in Deno 1.40.0 that did not
  impact the oak APIs, as well as a regression that has been fixed in patch
  releases that was worked around.

- fix: issues in current versions of node (43733a0)

  Current versions of Node.js had some issues that were not present in Node.js
  16. These were resolved.

- fix: application errors dispatched after default logic (f37796b)

  Resolved #630

- tests: add descriptions to some tests (9fb56b3)
- chore: rework exports (4bb93fb)
- chore: fix exports (6e2d9b3)
- chore: remove unused dep (ebe6801)
- chore: migrate to oak commons 0.5.0 (d5752e6)
- chore: remove unstable tests (9dc5ca7)
- chore: remove unused import (09fd336)
- chore: update to std 0.212.0 (a854c72)
- chore: fix exports (d416773)

## Version 12.6.3

- chore: add jsr metadata (6c30bdf)
- chore: rename deno.jsonc to deno.json (681da74)
- docs: fix typo in index.md (#600)

## Version 12.6.2

- chore: update to std 0.211.0, commons 0.4.0, dnt 0.39.0 (494aa7b)
- chore: remove deno bundle ci task (8db4394)

## Version 12.6.1

- fix: untrack http conns when closed (da6d30d)
- chore: remove unused lint pragma (614df5e)
- chore: update to std 0.200.0 and dnt 0.38.1 (eb51995)
- chore: fix type checking issue in build script (5ca2870)

## Version 12.6.0

- feat: add userAgent to request (e292470)

  `ctx.request` now contains an object representing the user agent in a property
  called `.userAgent`.

  See
  [std/http/user_agent#UserAgent](https://deno.land/std@0.193.0/http/user_agent.ts?s=UserAgent)
  for more information. Inspired by #603.

- chore: update to std 0.190.0 (4bf071d)
- chore: update to dnt 0.36.0 (2f394bf)
- chore: update dnt 0.37.0, std 0.193.0 (c052b2b)
- docs: remove outdated comment (f0ad28b)

## Version 12.5.0

- feat: body parsing throws HTTP errors. (79349d7)

  Now when parsing the body of a request, when an error is encountered, an HTTP
  error is thrown instead of a SyntaxError or TypeError. This makes it easier to
  respond to "bad requests" without additional error handling in middleware.

- fix: allow setting headers and expose on `Context.prototype.assert()` (#605)

  After migrating to HTTP errors from Deno std library, there were some
  regressions in functionality when passing options. This restores this lost
  functionality.

- chore: update to std 0.188.0 (1534696)
- chore: update to dnt 0.35.0 (02612c9)
- chore: revert CI to stable (635af06)
- chore: revert format change (91bf20f)
- chore: migrate to std for method, `ErrorStatus`, `RedirectStatus` (4870970)
- chore: update copyright years (022d50e)
- docs: remove extra words in FAQ.md (#606)

## Version 12.4.0

- feat: add context to fetch for proxy (b025488)

  When providing a `fetch()` method on proxy middleware init options, the method
  will be called with an init of `{ context }` which includes the current
  context. This allows advanced usage cases where the context impacts how the
  fetch is handled (e.g. like setting upstream request headers, etc.).

- chore: update to std 0.185.0 (07a011a)
- chore: update to dnt 0.34.0 (5064a71)
- chore: update to Deno 1.33 (e564135)
- chore: move CI to deno canary (811f531)

## Version 12.3.1

- **SECURITY** fix: avoid parse middleware DDOS (03c6b74)

  The parse middleware was using an exponentially complex regular expression to
  validate the `Forwarded` header on requests, making it trivial to create a
  request that would cause CPU exhaustion. This is now fixed.

- chore: reduce `50MB.zip` size (#487)

## Version 12.3.0

- feat: add `MiddlewareObject` (#589)

  Middleware can be registered as a middleware function or a `MiddlewareObject`
  which is an object which has a `handleRequest()` method and optionally an
  `init()` which will be called when the application starts listening.

- feat: add `"close"` event to Application (f564e38)

  The `Application` now emits a `"close"` event when it has stopped handling
  requests.

- feat: add `Router.prototype.add` to allow specifying methods (b8d0e80)

  The `.add()` method can be used on router instances to register middleware
  with arbitrary sets of HTTP methods. This allows usage of uncommon HTTP
  methods as well as potentially procedural configuration of the router.

- feat: add type guard (#502)

  The `isNativeRequest()` type guard is added which makes it easier to detect if
  a request is a Deno native request in order to be able to safely access the
  original request.

- fix: cleanup SSE and web socket on application close (11e4172)

  Previously, if the application stopped listening (closed), it would not close
  down SSE or socket connections, therefore making it difficult to shutdown
  cleanly. Now it should.

- fix: set body and headers when init'ing SSE (8685c7a)

  oak 12.2.0 did not properly convert over to the std libraries SSE target. It
  now handles this properly.

- docs: add "The response is not writable." to FAQs (be310ee)
- docs: add "early eof" to FAQs (6d21b7a)

## Version 12.2.0

- feat: remove experimental support for Deno flash server (d9f8829)

  Version 1.35 of Deno will remove the
  [experimental flash server](https://github.com/denoland/deno/pull/18568). The
  abstraction to the HTTP server that will be stabilised provides no benefit to
  oak, so the support for "flash" is being removed.

- refactor: use SSE from std (9a6ae5d)

  oak contributed `http/server_sent_event` to the Deno std library, and is now
  migrating to that.

- refactor: use std library for etag (e95bc10)

  oak contributed `http/etag` to the Deno std library, and is now migrating to
  that.

- fix: update sseServer example (14a5b5c)
- docs: remove experimental flash content from README (024aa8a)

## Version 12.1.0

- refactor: use `KeyStack` from std (d2eff20)

  oak contributed `KeyStack` to the Deno std library, and is now migrating to
  that.

- refactor: migrate to `SecureCookieMap` from std (b136fdc)

  oak contributed its cookie management to the Deno std library, and is now
  migrating to that.

## Version 12.0.1

- fix: decode empty request bodies for JSON as null (fa98626)
- fix: handle throwing in context construction (ba9b7cc)
- fix: send() doesn't set content-length header (b62de95)

## Version 12.0.0

- feat: `Router.prototype.all` uses all methods (4ddc851)

  **BREAKING** when using `Router.prototype.all()` to register middleware, it
  will now use all the methods (except `OPTIONS`) to register the middleware
  instead of an arbitrary set of common methods.

- fix: use null prototype with cookie match cache (798eca7)
- fix: `Router.prototype.all` omit `OPTIONS` method (98067a4)
- fix: use `"Allow"` versus `"Allowed"` header for `OPTIONS` (3bcd4eb)
- fix: update types for TypeScript 4.9 (31a1c7f)
- fix: save route name during route matching (#574)
- fix: zero `content-length` triggering max body size error (#552)
- fix: remove unused function from flash server (01264e6)
- chore: fix node tests (5ea9729)
- chore: update checkout action (811e0ea)
- chore: lint (b2a7356)
- chore: fmt (507990e)
- chore: rework ci (08a6e78)
- chore: update to std@0.178 and dnt@0.33.1 (0a7d616)
- tests: improve headers test coverage (#562)
- docs: update info on handling formdata files (#555)

## Version 11.1.0

- feat: provide options for JSON replacing and reviving (855ecf0)

  You can now set `jsonBodyReplacer` and `jsonBodyReviver` to assist when
  automatic decoding of JSON bodies in requests or responses occur. This allows
  custom logic to achieve things like handling bigints, circular references, and
  custom serialization of things like `RegExp`.

- fix: add missing generic parameters for multiple middlewares (#549)
- fix: refactor flash to align to Deno 1.25 release (f3976fc)
- fix: add flash support to staticServer example (48130a2)
- docs: repoint doc URL to just deno.land/x (8237e7a)

## Version 11.0.0

- feat: make overriding router parameter types easier (#513)

  When route type inference breaks down, it was previously difficult to provide
  a different set of asserted route parameters. This now makes it easier.

- feat: support Deno's experimental flash server (#545)

  As of this release Deno canary includes the experimental flash HTTP server
  which dramatically increases performance when running in Deno CLI. It is
  expected to ship as unstable in Deno 1.25. See the README and module doc for
  information on how to enable the flash server.

  oak's support for flash is also experimental at this point.

- refactor: update deps, migrate more to std/http

  Much of the common parts of oak have been being contributed back to `std/http`
  and refactoring to support this migration is underway. Because there are
  likely to be minor and subtle differences in how things operate, this release
  of oak is a major release. I am not currently aware of any major breaking
  changes, but wanted to ensure that people were consciously aware.

- docs: don't await body.value in examples (dbabc1c)
- docs: fix typo in multipart.ts JSDocs (#466)
- docs: improve maxSize and maxFileSize in multipart.ts (#467)
- chore: unpin deno version for CI (728ba71)

## Version 10.6.0

- feat: expose createHttpError (#525)
- fix: don't block subsequent requests on a connection (#529)
- fix: Deno.ListenTlsOptions detection (#521)
- docs: add missing await in README static content example. (#506)
- docs: "sever" to "server" in README (#509)
- docs: fix FAQ entry for addEventListener (#511)
- docs: fix typo in `multipart.ts` (#527)
- chore: update to Deno 1.22.0, std 0.140.0, media_types 3.0.3 (17d9e61)
- chore: fix ci (00ddfcd)

## Version 10.5.1

- chore: update to std 0.131.0, media_types 3.0.2, dnt 0.22.0 (c1e0ea9)
- chore: update codecov action (#494)
- chore: migrate to deno task and deno.jsonc (ccc39db)

## Version 10.5.0

- feat: application supports omitting options, defaults to port 0

  You can now avoid "boilerplate" code, especially on Deploy with `Application`
  `listen()` by not passing any config options to start listening.

- fix: update npm and fix issues
- tests: de-duplicate test name
- docs: add await to `etag.calculate` example (#480)
- chore: update to Deno 1.19.2, std 0.128.0, media_types 2.12.3

## Version 10.4.0

- feat: support CJS for npm package (2f38652)

  The npm distribution now includes ESM and CJS modules, enabling oak to be
  imported with `require()` in Node.js.

- refactor: remove dynamic import (e776011)

## Version 10.3.0

- feat: add experimental support for Node.js (#479)

  oak is now available as an Node.js npm package: `@oakserver/oak`. See
  [oak and Node.js](https://oakserver.github.io/oak/node) for more information.

- chore: update to Deno 1.19.0, media_types 2.12.2 (a4104a6)

## Version 10.2.1

- docs: improve inline documentation (bd7e692)
- chore: remove a workaround for a Deno bug (60327f9)

## Version 10.2.0

- feat: add support for custom content types when reading formdata (6cd2d53)

  When reading a form data body, you can now supply a record of custom content
  types to extension to use when handling custom content types.

- chore: update to Deno 1.18.1, std 0.123.0, media_types 2.12.1 (f399784)
- docs: improve inline docs (8831d51)

## Version 10.1.1

- fix: correct negotiation algorithm (ad6b896)
- fix: use interface to represent Deno.core instead of modifying global type
  scope (#444)
- chore: update to Deno 1.18, std 0.122.0, media_types 2.12.0 (26a22e9)
- chore: update CI to Deno 1.18 (a4d4c47)
- chore: update copyright dates (dd3910f)
- docs: Update README to represent changes made (#447)
- docs: improve static content (#450)

## Version 10.1.0

- fix: type assignment issues with TS 4.5 and later (2e76d12)
- fix: implement mock for Request#accepts (#432)
- chore: update to Deno 1.17.0, std 0.118.0 and media_types 2.11.1 (aa4e961)
- chore: remove dectyl (5aa9d23)
- chore: add bundling tests (50f311e)

## Version 10.0.0

- feat: remove `std/http` and `std/ws` (#408)

  **BREAKING CHANGE**

  All HTTP native server implementations have been stabilized in Deno, so the
  support of `std/http` and `std/ws` have been removed. There is no way to
  "force" oak to use the Deno `std/http`.

- feat: remove deprecated fetchEventHandler (6749922)

  **BREAKING CHANGE**

  The `.fetchEventHandler()` used with Deno Deploy which was deprecated has been
  removed. Deploy users should invoke oak just like they were using oak in the
  Deno CLI.

- feat: add limit when getting a request body (34c179b)

  **BREAKING CHANGE**

  There is a default limit when reading a body to avoid DDOS attacks where a
  malicious client can send a body that is too large for the server to handle.
  To disable the feature, set the `limit` option when reading a body to `0` or
  `Infinity`.

- feat: mocked contexts provide the cookies property (#422)

  The testing utilities now allow cookies to be provided when creating a mock
  context.

- feat: infer RouteParam types (9cf12d0)

  **BREAKING CHANGE**

  When using the `Router()` and adding middleware, the types have been updated
  to infer the route params property of the context from the route provided.

  This means in certain situations where the route params were asserted by
  setting the generic value is no longer necessary and can actually cause type
  errors. Users should just remove explicit generic settings and instead allow
  the type to be inferred from the route string.

- feat: add ignoreInsecure when setting a cookie (16cdcc1)

  Users attempting to set secure cookies in what appears to be an insecure
  context can use the `ignoreInsecure` option when setting the cookie to
  suppress the error.

- fix: refactor `request.hasBody` and `request.body()` (b1e2921)

  In HTTP/2 many requests with a body would actually be set to a zero length
  body, since the body cannot be reliably determined until it is attempted to be
  read. As of Deno 1.16.1 this behavior is also reflected in HTTP/1.1 requests.
  This highlighted that `.hasBody` is not a reliable API, and code was
  refactored to handle this better, as well as handle zero length and undefined
  bodies in `request.body()`. When asserting a specific body type, and there is
  not a body present, a zero length body of the type requested is returned,
  previously this would have thrown. This means it is now always safe to request
  a specific body type from `request.body()`.

- fix: proxy middleware doesn't use global flag on regex (#429)
- fix: decode path as URL, not component (dd4c091)

  This fixed issues where path separators that are encoded in the path are not
  decoded, which is better aligned to expectations and other middleware
  frameworks.

- docs: fix typo in Middleware import (#426)
- docs: Improved readability for getting started section (#421)
- docs: simplify code example (#414)
- chore: update to Deno 1.16.1, std 0.114.0, media_types 2.11.0 (1a4e488)
- chore: re-enable code cov upload (14b61cc)
- chore: ignore lint rule (950cf48)
- chore: update router examples (8463c22)

## Version 9.0.1

- feat: rename logging errors to uncaught application errors (be0390c)

  For clarity, application errors are no longer labelled as coming from oak, but
  instead are labelled as uncaught application errors.

- fix: ensure can close the native server by closing open http connections
  (#389)
- fix: ensure code works with no check (6157784)
- fix: upgrading connection to WebSocket (#401)
- docs: fix typo in FAQs (#390)
- docs: fix typo in README (#395)
- chore: add jobs flag to tests in ci (50bbe52)
- chore: only generate lcov on linux on ci (b956357)
- chore: make `useUnknownInCatchVariables` type safe (6f680c9)
- chore: move ci to Deno 1.14.0

## Version 9.0.0

- **BREAKING CHANGE** refactor: move to web crypto for cookie signing (14c6b47)

  Use the web crypto APIs for cookie signing and validation instead of the Deno
  `std` library. This introduces a **breaking change** in that getting and
  setting cookies are now performed asynchronously due to async nature of the
  web crypto APIs. Both `.cookies.get()` and `.cookies.set()` return promises
  which should be awaited.

- feat: support request event interface for Deploy (2aadac6)

  Add support for the request event interface for Deno Deploy, which is the same
  API as the _native_ Deno CLI http server API. This means that Deploy
  applications are started in the same way as if they are one the CLI, likely
  meaning that there is no change to using oak when moving between Deno CLI and
  Deploy. Deploy users should just `await app.listen()` like they would with CLI
  applications.

  This also _deprecates_ the `app.fetchEventHandler()` method. The method will
  be removed in future version of oak.

- refactor: move to web crypto instead of std createHash (2156f76)

  The web crypto APIs are now used for internal purposes like creating etags and
  generating temporary directories.

- refactor: clean-up of logic in `HttpError` constructor (#381)
- fix: listen event occurs on listen and contains correct info (44ab231)

  The listen event would not be dispatched at the right time and potentially not
  contain correct information. This has been fixed.

- fix: range requests properly handle single last byte requests (#373)

  Fixes an edge case where range requests requesting a single last byte would
  fail.

- fix: issue with types when using dom libs (7fcc494)
- fix: allow streaming the request body multiple times (#384)
- fix: malformed request url doesn't cause uncaught error (046c732)
- fix: clear headers properly when uncaught error (83f0841)
- chore: add easy dev container support (5eb2177)

  The repository contains dev container information, making it easy to clone the
  repo on GitHub and have a development environment.

- chore: update to Deno 1.13.1, std 0.105.0, media_types 2.10.1 (bc9b82b)
- chore: update to dectyl 0.10.3 (bc81512)
- docs: update request body types documentation in readme (#383)
- docs: update information about cookies API (d08dce7)

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
