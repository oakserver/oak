/*
 * This is a basic example of a test server which uses a `Deno.Reader` as the
 * body response.
 */

// Importing some console colors
import { bold, yellow } from "https://deno.land/std@0.217.0/fmt/colors.ts";
import { StringReader } from "https://deno.land/std@0.217.0/io/string_reader.ts";

import { Application } from "../mod.ts";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = new StringReader("Hello, Reader!");
  ctx.response.type = "text/plain";
});

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    bold("Start listening on ") + yellow(`${hostname}:${port}`),
  );
  console.log(bold("  using HTTP server: " + yellow(serverType)));
});

await app.listen({ hostname: "127.0.0.1", port: 8000 });
console.log(bold("Finished."));
