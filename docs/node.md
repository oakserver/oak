# Node.js

oak 10.3 introduces experimental support for Node.js 16.5 and later.

The package is available on npm as
[`@oakserver/oak`](https://www.npmjs.com/package/@oakserver/oak) and can be
installed with your preferred package manager.

The package shares the same API as if it were being used under Deno CLI or Deno
Deploy, and almost all functionality is the same.

A few notes about the support:

- The package includes all the type definitions, which should make it easy to
  use from within an intelligent IDE.
- The package uses `Headers` from [undici](https://github.com/nodejs/undici)
  which operate slightly different than the Deno `Headers` class. Generally this
  shouldn't cause issues for users and code, but it hasn't been extensively
  tested yet and so there maybe some behavioral changes.
- Currently `FormData` bodies that need to write out files to the file system do
  not work properly. This will be fixed in the future.
- Currently the package does not support upgrading a connection to web sockets.
  There are plans for this in the future.
- Currently the package only supports HTTP/1.1 server. There are plans to
  support HTTP/2 in the future.

## Usage

As mentioned above, installing the package `@oakserver/oak` should be
sufficient.

If you love kittens, you should consider using ES modules in Node.js and
importing from `"@oakserver/oak"`:

**index.mjs**

```js
import { Application } from "@oakserver/oak";

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello from oak on Node.js";
});

app.listen({ port: 8000 });
```

If you want to import it in a CommonJS module, `require()` can be used:

**index.js**

```js
const { Application } = require("@oakserver/oak");

const app = new Application();

app.use((ctx) => {
  ctx.response.body = "Hello from oak on Node.js";
});

app.listen({ port: 8000 });
```
