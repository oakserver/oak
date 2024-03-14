// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

import { assertEquals, unreachable } from "./test_deps.ts";

import {
  type IncomingMessage,
  NodeRequest,
  Server,
  type ServerResponse,
} from "./http_server_node.ts";

import { Application } from "./application.ts";

const destroyCalls: any[][] = [];
const setHeaderCalls: any[][] = [];
const writeCalls: any[][] = [];
const writeHeadCalls: any[][] = [];

function createMockReqRes(
  url = "/",
  headers: Record<string, string> = {},
  method = "GET",
  address = "127.0.0.1",
): [req: IncomingMessage, res: ServerResponse] {
  destroyCalls.length = 0;
  setHeaderCalls.length = 0;
  writeCalls.length = 0;
  writeHeadCalls.length = 0;
  const req = {
    headers,
    method,
    socket: {
      address() {
        return {
          addr: {
            address,
          },
        };
      },
    },
    url,
    on(_method: string, _listener: (arg?: any) => void) {},
  };
  const res = {
    destroy(...args: any[]) {
      destroyCalls.push(args);
    },
    end(callback?: () => void) {
      if (callback) {
        callback();
      }
    },
    setHeader(...args: any[]) {
      setHeaderCalls.push(args);
    },
    write(chunk: unknown, callback?: (err: Error | null) => void) {
      writeCalls.push([chunk, callback]);
      if (callback) {
        callback(null);
      }
    },
    writeHead(...args: any[]) {
      writeHeadCalls.push(args);
    },
  };
  return [req, res];
}

Deno.test({
  name: "NodeRequest",
  async fn() {
    const nodeRequest = new NodeRequest(
      ...createMockReqRes("/", {}, "POST", "127.0.0.1"),
    );
    assertEquals(nodeRequest.url, `/`);
    const response = new Response("hello deno");
    await nodeRequest.respond(response);
    assertEquals(writeHeadCalls, [[200, ""]]);
  },
});

Deno.test({
  name: "HttpServer closes gracefully after serving requests",
  // TODO(@kitsonk) this is failing locally for me, figure out what is wrong.
  ignore: true,
  async fn() {
    const app = new Application();
    const listenOptions = { port: 4508 };

    const server = new Server(app, listenOptions);
    await server.listen();

    const expectedBody = "test-body";

    (async () => {
      for await (const nodeRequest of server) {
        nodeRequest.respond(new Response(expectedBody));
      }
    })();

    try {
      const response = await fetch(`http://localhost:${listenOptions.port}`);
      assertEquals(await response.text(), expectedBody);
    } catch {
      unreachable();
    } finally {
      server.close();
    }
  },
});
