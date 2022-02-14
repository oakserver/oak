// Copyright 2018-2022 the oak authors. All rights reserved. MIT license.

export class ErrorEvent extends Event {
  #message: string;
  #filename: string;
  #lineno: number;
  #colno: number;
  // deno-lint-ignore no-explicit-any
  #error: any;

  get message(): string {
    return this.#message;
  }
  get filename(): string {
    return this.#filename;
  }
  get lineno(): number {
    return this.#lineno;
  }
  get colno(): number {
    return this.#colno;
  }
  // deno-lint-ignore no-explicit-any
  get error(): any {
    return this.#error;
  }

  constructor(type: string, eventInitDict: ErrorEventInit = {}) {
    super(type, eventInitDict);
    const { message = "error", filename = "", lineno = 0, colno = 0, error } =
      eventInitDict;
    this.#message = message;
    this.#filename = filename;
    this.#lineno = lineno;
    this.#colno = colno;
    this.#error = error;
  }
}
