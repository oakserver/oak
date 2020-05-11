// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Application, State } from "./application.ts";
import { Cookies } from "./cookies.ts";
import { ServerRequest } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import { KeyStack } from "./keyStack.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { ErrorStatus } from "./types.ts";

export class Context<S extends State = Record<string, any>> {
  /** A reference to the current application */
  app: Application<any>;

  /** The cookies object */
  cookies: Cookies;

  /** The request object */
  request: Request;

  /** The response object */
  response: Response = new Response();

  /** The object to pass state to front-end views.  This can be typed by
   * supplying the generic state argument when creating a new app.  For
   * example:
   *
   *       const app = new Application<{ foo: string }>();
   * 
   * Or can be contextually inferred based on setting an initial state object:
   * 
   *       const app = new Application({ state: { foo: "bar" } });
   * 
   */
  state: S;

  constructor(app: Application<S>, serverRequest: ServerRequest) {
    this.app = app;
    this.state = app.state;
    this.request = new Request(serverRequest);
    this.cookies = new Cookies(this.request, this.response, {
      keys: this.app.keys as KeyStack | undefined,
      secure: this.request.secure,
    });
  }

  /** Asserts the condition and if the condition fails, creates an HTTP error
   * with the provided status (which defaults to `500`).  The error status by 
   * default will be set on the `.response.status`.
   */
  assert(
    condition: any,
    errorStatus: ErrorStatus = 500,
    message?: string,
    props?: object,
  ): asserts condition {
    if (condition) {
      return;
    }
    const err = createHttpError(errorStatus, message);
    if (props) {
      Object.assign(err, props);
    }
    throw err;
  }

  /** Create and throw an HTTP Error, which can be used to pass status
   * information which can be caught by other middleware to send more
   * meaningful error messages back to the client.  The passed error status will
   * be set on the `.response.status` by default as well.
   */
  throw(errorStatus: ErrorStatus, message?: string, props?: object): never {
    const err = createHttpError(errorStatus, message);
    if (props) {
      Object.assign(err, props);
    }
    throw err;
  }
}
