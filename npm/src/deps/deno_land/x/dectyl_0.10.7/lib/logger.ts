// Copyright 2021 Deno Land Inc. All rights reserved. MIT license.

import * as colors from "../../../std_0.107.0/fmt/colors.js";

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

let logLevel = LogLevel.Warn;

/** Set the API's logging level. For the worker runtime, this only affects
 * newly created workers. */
export function setLevel(level: LogLevel) {
  logLevel = level;
}

export function debug(...data: unknown[]) {
  if (logLevel <= LogLevel.Debug) {
    console.debug(`[${colors.gray("debug")}]`, ...data);
  }
}

export function info(...data: unknown[]) {
  if (logLevel <= LogLevel.Info) {
    console.info(`[${colors.cyan("info")}]`, ...data);
  }
}

export function warn(...data: unknown[]) {
  if (logLevel <= LogLevel.Warn) {
    console.warn(`[${colors.yellow("warn")}]`, ...data);
  }
}

export function error(...data: unknown[]) {
  if (logLevel <= LogLevel.Error) {
    console.warn(`[${colors.red("error")}]`, ...data);
  }
}

export function log(level: LogLevel, ...data: unknown[]) {
  switch (level) {
    case LogLevel.Debug:
      return debug(...data);
    case LogLevel.Info:
      return info(...data);
    case LogLevel.Warn:
      return warn(...data);
    case LogLevel.Error:
      return error(...data);
  }
}
