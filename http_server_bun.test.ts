// Copyright 2018-2024 the oak authors. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

import { assert } from "./deps.ts";
import { assertEquals } from "./test_deps.ts";
import { createMockApp } from "./testing.ts";

import { Server } from "./http_server_bun.ts";

interface SocketAddress {
  address: string;
  port: number;
  family: "IPv4" | "IPv6";
}

let currentServer: MockBunServer | undefined;
let requests: Request[] = [];

class MockBunServer {
  stoppedCount = 0;
  fetch: (
    req: Request,
    server: this,
  ) => Response | Promise<Response>;
  responses: Response[] = [];
  runPromise: Promise<void>;

  development: boolean;
  hostname: string;
  port: number;
  pendingRequests = 0;

  async #run() {
    for (const req of requests) {
      const res = await this.fetch(req, this);
      this.responses.push(res);
    }
  }

  constructor(
    { fetch, hostname, port, development }: {
      fetch: (
        req: Request,
        server: unknown,
      ) => Response | Promise<Response>;
      hostname?: string;
      port?: number;
      development?: boolean;
      error?: (error: Error) => Response | Promise<Response>;
      tls?: {
        key?: string;
        cert?: string;
      };
    },
  ) {
    this.fetch = fetch;
    this.development = development ?? false;
    this.hostname = hostname ?? "localhost";
    this.port = port ?? 567890;
    currentServer = this;
    this.runPromise = this.#run();
  }

  requestIP(_req: Request): SocketAddress | null {
    return { address: "127.0.0.0", port: 567890, family: "IPv4" };
  }

  stop(): void {
    this.stoppedCount++;
  }
}

function setup(reqs?: Request[]) {
  if (reqs) {
    requests = reqs;
  }
  (globalThis as any)["Bun"] = {
    serve(options: any) {
      return new MockBunServer(options);
    },
  };
}

function teardown() {
  delete (globalThis as any)["Bun"];
  currentServer = undefined;
}

Deno.test({
  name: "bun server can listen",
  async fn() {
    setup();
    const server = new Server(createMockApp(), { port: 8080 });
    const listener = await server.listen();
    assertEquals(listener, { addr: { hostname: "localhost", port: 8080 } });
    assert(currentServer);
    assertEquals(currentServer.stoppedCount, 0);
    await server.close();
    assertEquals(currentServer.stoppedCount, 1);
    teardown();
  },
});

Deno.test({
  name: "bun server can process requests",
  // this is working but there is some sort of hanging promise somewhere I can't
  // narrow down at the moment
  ignore: true,
  async fn() {
    setup([new Request(new URL("http://localhost:8080/"))]);
    const server = new Server(createMockApp(), { port: 8080 });
    const listener = await server.listen();
    assertEquals(listener, { addr: { hostname: "localhost", port: 8080 } });
    assert(currentServer);
    for await (const req of server) {
      assert(!req.body);
      assertEquals(req.url, "/");
      await req.respond(new Response("hello world"));
    }
    await server.close();
    await currentServer.runPromise;
    assertEquals(currentServer.stoppedCount, 1);
    assertEquals(currentServer.responses.length, 1);
    teardown();
  },
});
