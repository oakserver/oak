# oak and Deno Deploy

oak v7.1.0 introduced support for [Deno Deploy](https://deno.com/deploy). Using
oak with Deno Deploy is just like using oak with the Deno CLI, and most things
should "just work".

This guide focuses on writing oak for a Deno Deploy application, and does not
cover in depth the usage of Deno Deploy. The
[Deno Deploy Docs](https://deno.com/deploy/docs) should be used for that.

## Considerations

There are a few considerations when currently with Deno Deploy:

- Deno Deploy does not currently support web sockets. Trying to upgrade a
  connection to a web socket will fail.
- The command line utility for Deploy
  ([`deployctl`](https://deno.com/deploy/docs/deployctl)) cannot properly type
  check oak at the moment. You should use `--no-check` to bypass type checking
  when using oak with `deployctl`.

## Handling requests

The biggest difference between using oak with Deno Deploy is that you don't open
a listener via the `.listen()` method, instead the `Application` class has a
method named `.fetchEventHandler()`. This method will create an event handler
which can be registered with the Deno Deploy `"fetch"` event. For example:

```ts
import { Application } from "https://deno.land/x/oak/mod.ts";

const app = new Application();

/* ... register middleware ... */

addEventListener("fetch", app.fetchEventHandler());
```

Then when your Deploy application receives requests, the oak application and
middleware will handle them.

## Better IDE Integration

If you are using the Deno CLI Language Server in your editor (like via
[vscode_deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)),
you can add the following to the top of a Deploy script to get better
intellisense.

```ts
/// <reference path="https://raw.githubusercontent.com/denoland/deployctl/main/types/deploy.fetchevent.d.ts" />
/// <reference path="https://raw.githubusercontent.com/denoland/deployctl/main/types/deploy.ns.d.ts" />
/// <reference path="https://raw.githubusercontent.com/denoland/deployctl/main/types/deploy.window.d.ts" />
```
