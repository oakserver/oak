import { HttpServerNode } from "../http_server_node.ts";
import { Application } from "../mod.ts";

const app = new Application({
  serverConstructor: HttpServerNode,
});
