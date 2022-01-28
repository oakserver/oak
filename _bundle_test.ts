/**
 * This module is used to validate that a valid bundle can be generated for
 * oak.
 */

import { Application, Router } from "./mod.ts";

const router = new Router();
const app = new Application();

router.get("/", () => {});

app.use(router.routes());
app.use(router.allowedMethods());
