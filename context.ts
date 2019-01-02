import { Request, ServerRequest } from "./request.ts";
import { Response } from "./response.ts";

export class Context {
  request: Request;
  response = new Response();

  constructor(serverRequest: ServerRequest) {
    this.request = new Request(serverRequest);
  }
}
