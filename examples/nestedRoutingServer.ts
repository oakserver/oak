import { Application } from "../application.ts";
import { Router } from "../router.ts";

const posts = new Router()
  .get("/", (ctx) => {
    ctx.response.body = `Forum: ${ctx.params.forumId}`;
  })
  .get("/:postId", (ctx) => {
    ctx.response.body =
      `Forum: ${ctx.params.forumId}, Post: ${ctx.params.postId}`;
  });

const forums = new Router()
  .use("/forums/:forumId/posts", posts.routes(), posts.allowedMethods());

console.log(
  `Responds to "http://localhost:8000/forums/oak/posts" and "http://localhost:8000/forums/oak/posts/nested-routers"`,
);

await new Application()
  .use(forums.routes())
  .listen({ port: 8000 });
