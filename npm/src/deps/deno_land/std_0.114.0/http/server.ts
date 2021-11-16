import * as denoShim from "deno.ns";
// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { delay } from "../async/mod.js";

/** Thrown by Server after it has been closed. */
const ERROR_SERVER_CLOSED = "Server closed";

/** Thrown when parsing an invalid address string. */
const ERROR_ADDRESS_INVALID = "Invalid address";

/** Default port for serving HTTP. */
const HTTP_PORT = 80;

/** Default port for serving HTTPS. */
const HTTPS_PORT = 443;

/** Initial backoff delay of 5ms following a temporary accept failure. */
const INITIAL_ACCEPT_BACKOFF_DELAY = 5;

/** Max backoff delay of 1s following a temporary accept failure. */
const MAX_ACCEPT_BACKOFF_DELAY = 1000;

/** Information about the connection a request arrived on. */
export interface ConnInfo {
  /** The local address of the connection. */
  readonly localAddr: denoShim.Deno.Addr;
  /** The remote address of the connection. */
  readonly remoteAddr: denoShim.Deno.Addr;
}

/**
 * A handler for HTTP requests. Consumes a request and connection information
 * and returns a response.
 *
 * If a handler throws, the server calling the handler will assume the impact
 * of the error is isolated to the individual request. It will catch the error
 * and close the underlying connection.
 */
export type Handler = (
  request: denoShim.Request,
  connInfo: ConnInfo,
) => denoShim.Response | Promise<denoShim.Response>;

/**
 * Parse an address from a string.
 *
 * Throws a `TypeError` when the address is invalid.
 *
 * ```ts
 * import { _parseAddrFromStr } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const addr = "::1:8000";
 * const listenOptions = _parseAddrFromStr(addr);
 * ```
 *
 * @param addr The address string to parse.
 * @param defaultPort Default port when not included in the address string.
 * @return The parsed address.
 */
export function _parseAddrFromStr(
  addr: string,
  defaultPort = HTTP_PORT,
): denoShim.Deno.ListenOptions {
  const host = addr.startsWith(":") ? `0.0.0.0${addr}` : addr;

  let url: URL;

  try {
    url = new URL(`http://${host}`);
  } catch {
    throw new TypeError(ERROR_ADDRESS_INVALID);
  }

  if (
    url.username ||
    url.password ||
    url.pathname != "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(ERROR_ADDRESS_INVALID);
  }

  return {
    hostname: url.hostname,
    port: url.port === "" ? defaultPort : Number(url.port),
  };
}

/** Options for running an HTTP server. */
export interface ServerInit {
  /**
   * Optionally specifies the address to listen on, in the form
   * "host:port".
   *
   * If the port is omitted, `:80` is used by default for HTTP when invoking
   * non-TLS methods such as `Server.listenAndServe`, and `:443` is
   * used by default for HTTPS when invoking TLS methods such as
   * `Server.listenAndServeTls`.
   *
   * If the host is omitted, the non-routable meta-address `0.0.0.0` is used.
   */
  addr?: string;

  /** The handler to invoke for individual HTTP requests. */
  handler: Handler;
}

/** Used to construct an HTTP server. */
export class Server {
  #addr?: string;
  #handler: Handler;
  #closed = false;
  #listeners: Set<denoShim.Deno.Listener> = new Set();
  #httpConnections: Set<denoShim.Deno.HttpConn> = new Set();

  /**
   * Constructs a new HTTP Server instance.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const addr = ":4505";
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ addr, handler });
   * ```
   *
   * @param serverInit Options for running an HTTP server.
   */
  constructor(serverInit: ServerInit) {
    this.#addr = serverInit.addr;
    this.#handler = serverInit.handler;
  }

  /**
   * Accept incoming connections on the given listener, and handle requests on
   * these connections with the given handler.
   *
   * HTTP/2 support is only enabled if the provided Deno.Listener returns TLS
   * connections and was configured with "h2" in the ALPN protocols.
   *
   * Throws a server closed error if called after the server has been closed.
   *
   * Will always close the created listener.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ handler });
   * const listener = Deno.listen({ port: 4505 });
   *
   * console.log("server listening on http://localhost:4505");
   *
   * await server.serve(listener);
   * ```
   *
   * @param listener The listener to accept connections from.
   */
  async serve(listener: denoShim.Deno.Listener): Promise<void> {
    if (this.#closed) {
      throw new denoShim.Deno.errors.Http(ERROR_SERVER_CLOSED);
    }

    this.#trackListener(listener);

    try {
      return await this.#accept(listener);
    } finally {
      this.#untrackListener(listener);

      try {
        listener.close();
      } catch {
        // Listener has already been closed.
      }
    }
  }

  /**
   * Create a listener on the server, accept incoming connections, and handle
   * requests on these connections with the given handler.
   *
   * If the server was constructed with the port omitted from the address, `:80`
   * is used.
   *
   * If the server was constructed with the host omitted from the address, the
   * non-routable meta-address `0.0.0.0` is used.
   *
   * Throws a server closed error if the server has been closed.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const addr = ":4505";
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ addr, handler });
   *
   * console.log("server listening on http://localhost:4505");
   *
   * await server.listenAndServe();
   * ```
   */
  async listenAndServe(): Promise<void> {
    if (this.#closed) {
      throw new denoShim.Deno.errors.Http(ERROR_SERVER_CLOSED);
    }

    const addr = this.#addr ?? `:${HTTP_PORT}`;
    const listenOptions = _parseAddrFromStr(addr, HTTP_PORT);

    const listener = denoShim.Deno.listen({
      ...listenOptions,
      transport: "tcp",
    });

    return await this.serve(listener);
  }

  /**
   * Create a listener on the server, accept incoming connections, upgrade them
   * to TLS, and handle requests on these connections with the given handler.
   *
   * If the server was constructed with the port omitted from the address, `:443`
   * is used.
   *
   * If the server was constructed with the host omitted from the address, the
   * non-routable meta-address `0.0.0.0` is used.
   *
   * Throws a server closed error if the server has been closed.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const addr = ":4505";
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ addr, handler });
   *
   * const certFile = "/path/to/certFile.crt";
   * const keyFile = "/path/to/keyFile.key";
   *
   * console.log("server listening on https://localhost:4505");
   *
   * await server.listenAndServeTls(certFile, keyFile);
   * ```
   *
   * @param certFile The path to the file containing the TLS certificate.
   * @param keyFile The path to the file containing the TLS private key.
   */
  async listenAndServeTls(certFile: string, keyFile: string): Promise<void> {
    if (this.#closed) {
      throw new denoShim.Deno.errors.Http(ERROR_SERVER_CLOSED);
    }

    const addr = this.#addr ?? `:${HTTPS_PORT}`;
    const listenOptions = _parseAddrFromStr(addr, HTTPS_PORT);

    const listener = denoShim.Deno.listenTls({
      ...listenOptions,
      certFile,
      keyFile,
      transport: "tcp",
      // ALPN protocol support not yet stable.
      // alpnProtocols: ["h2", "http/1.1"],
    });

    return await this.serve(listener);
  }

  /**
   * Immediately close the server listeners and associated HTTP connections.
   *
   * Throws a server closed error if called after the server has been closed.
   */
  close(): void {
    if (this.#closed) {
      throw new denoShim.Deno.errors.Http(ERROR_SERVER_CLOSED);
    }

    this.#closed = true;

    for (const listener of this.#listeners) {
      try {
        listener.close();
      } catch {
        // Listener has already been closed.
      }
    }

    this.#listeners.clear();

    for (const httpConn of this.#httpConnections) {
      this.#closeHttpConn(httpConn);
    }

    this.#httpConnections.clear();
  }

  /** Get whether the server is closed. */
  get closed(): boolean {
    return this.#closed;
  }

  /** Get the list of network addresses the server is listening on. */
  get addrs(): denoShim.Deno.Addr[] {
    return Array.from(this.#listeners).map((listener) => listener.addr);
  }

  /**
   * Responds to an HTTP request.
   *
   * @param requestEvent The HTTP request to respond to.
   * @param httpCon The HTTP connection to yield requests from.
   * @param connInfo Information about the underlying connection.
   */
  async #respond(
    requestEvent: denoShim.Deno.RequestEvent,
    httpConn: denoShim.Deno.HttpConn,
    connInfo: ConnInfo,
  ): Promise<void> {
    try {
      // Handle the request event, generating a response.
      const response = await this.#handler(
        requestEvent.request,
        connInfo,
      );

      // Send the response.
      await requestEvent.respondWith(response);
    } catch {
      // If the handler throws then it is assumed that the impact of the error
      // is isolated to the individual request, so we close the connection.
      //
      // Alternatively the connection has already been closed, or there is some
      // other error with responding on this connection that prompts us to
      // close it and open a new connection.
      return this.#closeHttpConn(httpConn);
    }
  }

  /**
   * Serves all HTTP requests on a single connection.
   *
   * @param httpConn The HTTP connection to yield requests from.
   * @param connInfo Information about the underlying connection.
   */
  async #serveHttp(
    httpConn: denoShim.Deno.HttpConn,
    connInfo: ConnInfo,
  ): Promise<void> {
    while (!this.#closed) {
      let requestEvent: denoShim.Deno.RequestEvent | null;

      try {
        // Yield the new HTTP request on the connection.
        requestEvent = await httpConn.nextRequest();
      } catch {
        // Connection has been closed.
        break;
      }

      if (requestEvent === null) {
        // Connection has been closed.
        break;
      }

      // Respond to the request. Note we do not await this async method to
      // allow the connection to handle multiple requests in the case of h2.
      this.#respond(requestEvent, httpConn, connInfo);
    }

    this.#closeHttpConn(httpConn);
  }

  /**
   * Accepts all connections on a single network listener.
   *
   * @param listener The listener to accept connections from.
   */
  async #accept(
    listener: denoShim.Deno.Listener,
  ): Promise<void> {
    let acceptBackoffDelay: number | undefined;

    while (!this.#closed) {
      let conn: denoShim.Deno.Conn;

      try {
        // Wait for a new connection.
        conn = await listener.accept();
      } catch (error) {
        if (
          // The listener is closed.
          error instanceof denoShim.Deno.errors.BadResource ||
          // TLS handshake errors.
          error instanceof denoShim.Deno.errors.InvalidData ||
          error instanceof denoShim.Deno.errors.UnexpectedEof ||
          error instanceof denoShim.Deno.errors.ConnectionReset ||
          error instanceof denoShim.Deno.errors.NotConnected
        ) {
          // Backoff after transient errors to allow time for the system to
          // recover, and avoid blocking up the event loop with a continuously
          // running loop.
          if (!acceptBackoffDelay) {
            acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY;
          } else {
            acceptBackoffDelay *= 2;
          }

          if (acceptBackoffDelay >= MAX_ACCEPT_BACKOFF_DELAY) {
            acceptBackoffDelay = MAX_ACCEPT_BACKOFF_DELAY;
          }

          await delay(acceptBackoffDelay);

          continue;
        }

        throw error;
      }

      acceptBackoffDelay = undefined;

      // "Upgrade" the network connection into an HTTP connection.
      let httpConn: denoShim.Deno.HttpConn;

      try {
        httpConn = denoShim.Deno.serveHttp(conn);
      } catch {
        // Connection has been closed.
        continue;
      }

      // Closing the underlying listener will not close HTTP connections, so we
      // track for closure upon server close.
      this.#trackHttpConnection(httpConn);

      const connInfo: ConnInfo = {
        localAddr: conn.localAddr,
        remoteAddr: conn.remoteAddr,
      };

      // Serve the requests that arrive on the just-accepted connection. Note
      // we do not await this async method to allow the server to accept new
      // connections.
      this.#serveHttp(httpConn, connInfo);
    }
  }

  /**
   * Untracks and closes an HTTP connection.
   *
   * @param httpConn The HTTP connection to close.
   */
  #closeHttpConn(httpConn: denoShim.Deno.HttpConn): void {
    this.#untrackHttpConnection(httpConn);

    try {
      httpConn.close();
    } catch {
      // Connection has already been closed.
    }
  }

  /**
   * Adds the listener to the internal tracking list.
   *
   * @param listener Listener to track.
   */
  #trackListener(listener: denoShim.Deno.Listener): void {
    this.#listeners.add(listener);
  }

  /**
   * Removes the listener from the internal tracking list.
   *
   * @param listener Listener to untrack.
   */
  #untrackListener(listener: denoShim.Deno.Listener): void {
    this.#listeners.delete(listener);
  }

  /**
   * Adds the HTTP connection to the internal tracking list.
   *
   * @param httpConn HTTP connection to track.
   */
  #trackHttpConnection(httpConn: denoShim.Deno.HttpConn): void {
    this.#httpConnections.add(httpConn);
  }

  /**
   * Removes the HTTP connection from the internal tracking list.
   *
   * @param httpConn HTTP connection to untrack.
   */
  #untrackHttpConnection(httpConn: denoShim.Deno.HttpConn): void {
    this.#httpConnections.delete(httpConn);
  }
}

/** Additional serve options. */
export interface ServeInit {
  /**
   * Optionally specifies the address to listen on, in the form
   * "host:port".
   */
  addr?: string;

  /** An AbortSignal to close the server and all connections. */
  signal?: AbortSignal;
}

/**
 * Constructs a server, accepts incoming connections on the given listener, and
 * handles requests on these connections with the given handler.
 *
 * ```ts
 * import { serveListener } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const listener = Deno.listen({ port: 4505 });
 *
 * console.log("server listening on http://localhost:4505");
 *
 * await serveListener(listener, (request) => {
 *   const body = `Your user-agent is:\n\n${request.headers.get(
 *     "user-agent",
 *   ) ?? "Unknown"}`;
 *
 *   return new Response(body, { status: 200 });
 * });
 * ```
 *
 * @param listener The listener to accept connections from.
 * @param handler The handler for individual HTTP requests.
 * @param options Optional serve options.
 */
export async function serveListener(
  listener: denoShim.Deno.Listener,
  handler: Handler,
  options?: Omit<ServeInit, "addr">,
): Promise<void> {
  const server = new Server({ handler });

  if (options?.signal) {
    options.signal.onabort = () => server.close();
  }

  return await server.serve(listener);
}

/** Serves HTTP requests with the given handler.
 *
 * You can specifies `addr` option, which is the address to listen on,
 * in the form "host:port". The default is "0.0.0.0:8000".
 *
 * The below example serves with the port 8000.
 *
 * ```ts
 * import { serve } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 * serve((_req) => new Response("Hello, world"));
 * ```
 *
 * You can change the listening address by `addr` option. The below example
 * serves with the port 3000.
 *
 * ```ts
 * import { serve } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 * console.log("server is starting at localhost:3000");
 * serve((_req) => new Response("Hello, world"), { addr: ":3000" });
 * ```
 *
 * @param handler The handler for individual HTTP requests.
 * @param options The options. See `ServeInit` documentation for details.
 */
export async function serve(
  handler: Handler,
  options: ServeInit = {},
): Promise<void> {
  const addr = options.addr ?? ":8000";
  const server = new Server({ addr, handler });

  if (options?.signal) {
    options.signal.onabort = () => server.close();
  }

  return await server.listenAndServe();
}

interface ServeTlsInit extends ServeInit {
  /** The path to the file containing the TLS private key. */
  keyFile: string;

  /** The path to the file containing the TLS certificate */
  certFile: string;
}

/** Serves HTTPS requests with the given handler.
 *
 * You must specify `keyFile` and `certFile` options.
 *
 * You can specifies `addr` option, which is the address to listen on,
 * in the form "host:port". The default is "0.0.0.0:8443".
 *
 * The below example serves with the default port 8443.
 *
 * ```ts
 * import { serveTls } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 * const certFile = "/path/to/certFile.crt";
 * const keyFile = "/path/to/keyFile.key";
 * console.log("server is starting at https://localhost:8443");
 * serveTls((_req) => new Response("Hello, world"), { certFile, keyFile });
 * ```
 *
 * @param handler The handler for individual HTTPS requests.
 * @param options The options. See `ServeTlsInit` documentation for details.
 * @returns
 */
export async function serveTls(
  handler: Handler,
  options: ServeTlsInit,
): Promise<void> {
  if (!options.keyFile) {
    throw new Error("TLS config is given, but 'keyFile' is missing.");
  }

  if (!options.certFile) {
    throw new Error("TLS config is given, but 'certFile' is missing.");
  }

  const addr = options.addr ?? ":8443";
  const server = new Server({ addr, handler });

  if (options?.signal) {
    options.signal.onabort = () => server.close();
  }

  return await server.listenAndServeTls(
    options.certFile,
    options.keyFile,
  );
}

/**
 * @deprecated Use `serve` instead.
 *
 * Constructs a server, creates a listener on the given address, accepts
 * incoming connections, and handles requests on these connections with the
 * given handler.
 *
 * If the port is omitted from the address, `:80` is used.
 *
 * If the host is omitted from the address, the non-routable meta-address
 * `0.0.0.0` is used.
 *
 * ```ts
 * import { listenAndServe } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const addr = ":4505";
 *
 * console.log("server listening on http://localhost:4505");
 *
 * await listenAndServe(addr, (request) => {
 *   const body = `Your user-agent is:\n\n${request.headers.get(
 *     "user-agent",
 *   ) ?? "Unknown"}`;
 *
 *   return new Response(body, { status: 200 });
 * });
 * ```
 *
 * @param addr The address to listen on.
 * @param handler The handler for individual HTTP requests.
 * @param options Optional serve options.
 */
export async function listenAndServe(
  addr: string,
  handler: Handler,
  options?: ServeInit,
): Promise<void> {
  const server = new Server({ addr, handler });

  if (options?.signal) {
    options.signal.onabort = () => server.close();
  }

  return await server.listenAndServe();
}

/**
 * @deprecated Use `serveTls` instead.
 *
 * Constructs a server, creates a listener on the given address, accepts
 * incoming connections, upgrades them to TLS, and handles requests on these
 * connections with the given handler.
 *
 * If the port is omitted from the address, `:443` is used.
 *
 * If the host is omitted from the address, the non-routable meta-address
 * `0.0.0.0` is used.
 *
 * ```ts
 * import { listenAndServeTls } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const addr = ":4505";
 * const certFile = "/path/to/certFile.crt";
 * const keyFile = "/path/to/keyFile.key";
 *
 * console.log("server listening on http://localhost:4505");
 *
 * await listenAndServeTls(addr, certFile, keyFile, (request) => {
 *   const body = `Your user-agent is:\n\n${request.headers.get(
 *     "user-agent",
 *   ) ?? "Unknown"}`;
 *
 *   return new Response(body, { status: 200 });
 * });
 * ```
 *
 * @param addr The address to listen on.
 * @param certFile The path to the file containing the TLS certificate.
 * @param keyFile The path to the file containing the TLS private key.
 * @param handler The handler for individual HTTP requests.
 * @param options Optional serve options.
 */
export async function listenAndServeTls(
  addr: string,
  certFile: string,
  keyFile: string,
  handler: Handler,
  options?: ServeInit,
): Promise<void> {
  const server = new Server({ addr, handler });

  if (options?.signal) {
    options.signal.onabort = () => server.close();
  }

  return await server.listenAndServeTls(certFile, keyFile);
}
