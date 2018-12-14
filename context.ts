import { Status } from "./deps";
import { Request, ServerRequest } from "./request";
import { Response } from "./response";

export class Context {
  request: Request;
  response = new Response();

  constructor(serverRequest: ServerRequest) {
    this.request = new Request(serverRequest);
    this.response.status = Status.OK;
  }
}
