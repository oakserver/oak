# Copilot Instructions for oak

## Overview

oak is a middleware framework for Deno's native HTTP server,
[Deno Deploy](https://deno.com/deploy), Node.js, [Bun](https://bun.sh/), and
[Cloudflare Workers](https://workers.cloudflare.com/). It is inspired by
[Koa](https://github.com/koajs/koa/) and includes a middleware router inspired
by [@koa/router](https://github.com/koajs/router/). The package is distributed
via [JSR](https://jsr.io/@oak/oak).

## Repository Structure

- **Root-level `.ts` files** — Core framework modules (e.g., `application.ts`,
  `router.ts`, `context.ts`, `request.ts`, `response.ts`, `body.ts`, `send.ts`).
- **`middleware/`** — Built-in middleware (etag, proxy, serve).
- **`utils/`** — Internal utility functions and type guards.
- **`*.test.ts`** — Test files co-located with source files.
- **`deps.ts`** — Centralized runtime dependencies (always import shared deps from here).
- **`deps_test.ts`** — Centralized test-only dependencies.
- **`mod.ts`** — Public entry point that re-exports the full public API.
- **`types.ts`** — Shared TypeScript types and interfaces.
- **`examples/`** — Example usage scripts (not published).
- **`fixtures/`** — Test fixtures (not published).
- **`docs/`** — Documentation site source (not published).

## Development Commands

All commands use the [Deno](https://deno.com/) toolchain (no `npm` or build step needed).

| Task | Command |
|---|---|
| Run tests | `deno task test` |
| Run tests with coverage | `deno task test:coverage` |
| Generate lcov report | `deno task coverage` |
| Format code | `deno fmt` |
| Check formatting | `deno fmt --check` |
| Lint code | `deno lint` |

## Coding Conventions

- **Language**: TypeScript, targeting Deno-first with cross-runtime support (Node.js, Bun).
- **Copyright header**: Every source file begins with:
  ```ts
  // Copyright 2018-2025 the oak authors. All rights reserved. MIT license.
  ```
- **Imports**: Use relative imports with `.ts` extensions (e.g., `import { foo } from "./bar.ts"`).
  Shared dependencies are imported via `deps.ts`; test-only dependencies via `deps_test.ts`.
- **JSDoc**: Public APIs are documented with JSDoc. Module-level doc comments end with a `@module` tag.
- **Formatting**: Enforced by `deno fmt`. Do not manually adjust whitespace or indentation.
- **Linting**: Enforced by `deno lint`. The `no-import-prefix` rule is disabled (see `deno.json`).
- **Tests**: Co-located `*.test.ts` files. Use `assertEquals`, `assertStrictEquals`, and
  `assertRejects` from `deps_test.ts`. Mock helpers are defined locally within test files.
- **Error handling**: Use the `errors` object from `deps.ts` for HTTP error classes.
- **Exports**: All public symbols are re-exported from `mod.ts`. The `deno.json`
  `exports` field also defines the package entry points for JSR publishing.
