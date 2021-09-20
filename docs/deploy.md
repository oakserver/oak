# oak and Deno Deploy

oak v7.1.0 introduced support for [Deno Deploy](https://deno.com/deploy), and as
of v10.0.0 removes the fetch event interface. Using oak with Deno Deploy is just
like using oak with the Deno CLI, and most things should "just work".

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
