// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.

import { Context } from "./context.ts";
import {
  HTTPSOptions,
  serve as defaultServe,
  serveTLS as defaultServeTls,
  ServerRequest,
  Server
} from "./deps.ts";
import { Key, KeyStack } from "./keyStack.ts";
import { compose, Middleware } from "./middleware.ts";
import { BodyContentTypes } from "./request.ts";

export interface ApplicationOptions<S> {
  /** An initial set of keys (or instance of `KeyGrip`) to be used for signing
   * cookies produced by the application. */
  keys?: KeyStack | Key[];

  /** The `server()` function to be used to read requests.
   * 
   * _Not used generally, as this is just for mocking for test purposes_ */
  serve?: typeof defaultServe;

  /** The `server()` function to be used to read requests.
   * 
   * _Not used generally, as this is just for mocking for test purposes_ */
  serveTls?: typeof defaultServeTls;

  /** The initial state object for the application, of which the type can be
   * used to infer the type of the state for both the application and any of the
   * application's context. */
  state?: S;
}

export type State = Record<string | number | symbol, any>;

/** A class which registers middleware (via `.use()`) and then processes
 * inbound requests against that middleware (via `.listen()`).
 *
 * The `context.state` can be typed via passing a generic argument when
 * constructing an instance of `Application`.
 */
export class Application<S extends State = Record<string, any>> {
  #keys?: KeyStack;
  #middleware: Middleware<S, Context<S>>[] = [];
  #serve: typeof defaultServe;
  #serveTls: typeof defaultServeTls;
  #server: Server | undefined

  /** Optional additional content types that should be used for parsing of the
   * body in requests.  Valid keys are `json`, `text`, and `form`.
   * 
   * For example, to have JavaScript automatically parsed as text, you would do
   * the following:
   * 
   *       const app = new Application();
   *       app.bodyContentTypes = { text: ["application/javascript"] };
   * 
   */
  bodyContentTypes?: BodyContentTypes;

  /** A set of keys, or an instance of `KeyStack` which will be used to sign
   * cookies read and set by the application to avoid tampering with the
   * cookies. */
  get keys(): KeyStack | Key[] | undefined {
    return this.#keys;
  }

  set keys(keys: KeyStack | Key[] | undefined) {
    if (!keys) {
      this.#keys = undefined;
      return;
    } else if (Array.isArray(keys)) {
      this.#keys = new KeyStack(keys);
    } else {
      this.#keys = keys;
    }
  }

  /** Generic state of the application, which can be specified by passing the
   * generic argument when constructing:
   *
   *       const app = new Application<{ foo: string }>();
   * 
   * Or can be contextually inferred based on setting an initial state object:
   * 
   *       const app = new Application({ state: { foo: "bar" } });
   * 
   */
  state: S;


  constructor(options: ApplicationOptions<S> = {}) {
    const {
      state,
      keys,
      serve = defaultServe,
      serveTls = defaultServeTls,
    } = options;

    this.keys = keys;
    this.state = state ?? {} as S;
    this.#serve = serve;
    this.#serveTls = serveTls;
  }

  /** Processing registered middleware on each request. */
  #handleRequest = async (
    request: ServerRequest,
    middleware: (context: Context<S>) => Promise<void>,
  ) => {
    const context = new Context(this, request);
    await middleware(context);
    await request.respond(context.response.toServerResponse());
  };

  /** Start listening for requests over HTTP, processing registered middleware
   * on each request. */
  async listen(addr: string | Deno.ListenOptions): Promise<void> {
    
    const middleware = compose(this.#middleware);
    this.#server = this.#serve(addr);

    for await (const request of this.#server) {
      this.#handleRequest(request, middleware);
    }
  }

  /** Start listening for requests over HTTPS, processing registered middleware
   * on each request. */
  async listenTLS(options: HTTPSOptions): Promise<void> {
    
    const middleware = compose(this.#middleware);
    this.#server = this.#serveTls(options);
    
    for await (const request of this.#server) {
      this.#handleRequest(request, middleware);
    }
  }

  async close() {

    if (!this.#server) 
      throw "Server cannot be closed if not started";

    await this.#server.close();
  }

  /** Register middleware to be used with the application. */
  use(...middleware: Middleware<S, Context<S>>[]): this {
    this.#middleware.push(...middleware);
    return this;
  }
}
