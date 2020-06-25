# Server-Sent Events

Oak has built in support for server-sent events. Server-sent events are a one
way communication protocol which is part of the
[web standards](https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events).

The typical flow of establishing a connection is that the client will create
an `EventSource` object that points at a path on the server:

```js
const eventSource = new EventSource("/sse");
```

The server will respond by keeping open an HTTP connection which will be used
to send messages:

```ts
import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const app = new Application();
const router = new Router();

router.get("/sse", (ctx) => {
  const target = ctx.sendEvents();
  target.dispatchMessage({ hello: "world" });
});

app.use(router.router());
await app.listen({ port: 80 });
```

The far end can close the connection, which can be detected by the `close` event
on the target:

```ts
router.get("/sse", (ctx) => {
  const target = ctx.sendEvents();
  target.addEventListener("close", (evt) => {
    // perform some cleanup activities
  });
  target.dispatchMessage({ hello: "world" });
});
```

The server side can also close the connection:

```ts
router.get("/sse", async (ctx) => {
  const target = ctx.sendEvents();
  target.dispatchMessage({ hello: "world" });
  await target.close();
});
```

The basic concept here is that events that are raised against the target
returned from `.sendEvents()` are raised as events in the client's
`EventSource`. Because both the server interface (`ServerSentEventTarget`) and
the client interface (`EventSource`) extend `EventTarget` the server and client
APIs are very similar.

Oak provides a specialised event constructor which supports the features of the
server-sent event protocol. A `ServerSentEvent` event that is created on the
server and dispatched via the `ServerSentEventTarget` will be raised as a
`MessageEvent` on the client's `EventSource`. So on the server side:

```ts
router.get("/sse", async (ctx: Context) => {
  const target = ctx.sendEvents();
  const event = new ServerSentEvent("ping", { hello: "world" });
  target.dispatchEvent(event);
});
```

Would work like this on the client side:

```ts
const source = new EventSource("/sse");
source.addEventListener("ping", (evt) => {
  console.log(evt.data); // should log a string of `{"hello":"world"}`
});
```

Events that are dispatched on the server `SeverSentEventTarget` can be listened
to locally before they are sent to the client. This means if the event is
cancellable, event listeners can `.preventDefault()` on the event to cancel the
event, which will then not be sent so the client.

In addition to `.dispatchEvent()` there are also `.dispatchMessage()` and
`.dispatchComment()`. `.dispatchMessage()` will send a "data only" message to
the client. The `EventSource` in the client makes these events available on the
`.onmessage` property and the event type of `"message"`. `.dispatchComment()`
is sent to the client, but does not raise itself in the `EventSource`. It is
intended to be used for debugging purposes as well as a potential mechanism to
help keep the connection alive.

## Establishing the connection

Typically a client will utilise an `EventSource` to make a connection to the
endpoint, but server-sent events are a standard of transferring information, so
it is possible that a client might not be using an `EventSource` or a client
has accidentally called an endpoint and implementations might want to ensure the
client request intends to support server-sent events:

```ts
ctx.request.accepts("text/event-stream");
```

When `.sendEvents()` is called, the start of the response is sent to the client,
which is a HTTP 200 OK response with specific headers of:

```
HTTP/1.1 200 OK
Connection: Keep-Alive
Content-Type: text/event-stream
Cache-Control: no-cache
Keep-Alive: timeout=9007199254740991

```

This should be sufficient for most scenarios, but if you require additional
headers or need to override any of these headers, pass an instance of `Headers`
when calling `.sendEvents()`:

```ts
router.get("/sse", async (ctx: Context) => {
  const headers = new Headers([["X-Custom-Header", "custom value"]]);
  const target = ctx.sendEvents({ headers });
  const event = new ServerSentEvent("ping", { hello: "world" });
  target.dispatchEvent(event);
});
```
