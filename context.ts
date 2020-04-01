// Copyright 2018-2019 the oak authors. All rights reserved. MIT license.

import { Application } from "./application.ts";
import { ServerRequest } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { ErrorStatus } from "./types.ts";
import CookieHandler from "./cookieHandler.ts";

export class Context<S extends object = { [key: string]: any }> {
  /** A reference to the current application */
  app: Application<any>;

  /** The request object */
  request: Request;

  /** The response object */
  response = new Response();

  /** The cookie handler */
  cookies: CookieHandler;

  /** The object to pass state to front-end views.  This can be typed by
   * supplying the generic state argument when creating a new app.  For
   * example:
   *
   *       const app = new Application<{ foo: string }>();
   *
   */
  state: S;

  constructor(app: Application<S>, serverRequest: ServerRequest) {
    this.app = app;
    this.state = app.state;
    this.request = new Request(serverRequest);
    this.cookies = new CookieHandler(serverRequest, this.response);
  }

  /** Create and throw an HTTP Error, which can be used to pass status
   * information which can be caught by other middleware to send more
   * meaningful error messages back to the client.
   */
  throw(errorStatus: ErrorStatus, message?: string, props?: object): never {
    const err = createHttpError(errorStatus, message);
    if (props) {
      Object.assign(err, props);
    }
    throw err;
  }
}
