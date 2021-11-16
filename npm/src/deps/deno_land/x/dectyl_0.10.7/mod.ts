// Copyright 2021 Deno Land Inc. All rights reserved. MIT license.

export { check, createWorker } from "./lib/deploy_worker.js";
export type { DeployWorker } from "./lib/deploy_worker.js";
export * as handlers from "./lib/handlers.js";
export { LogLevel, setLevel as setLogLevel } from "./lib/logger.js";
export * as testing from "./lib/testing.js";
export type {
  DeployOptions,
  DeployWorkerInfo,
  FetchHandler,
} from "./types.d.js";
