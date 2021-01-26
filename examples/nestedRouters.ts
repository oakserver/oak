import { Application } from "../application.ts";
import { Router } from "../router.ts";

const posts = new Router()
  .get<{ forumId: string }>("/", (ctx) => {
    ctx.response.body = `Forum: ${ctx.params.forumId}`;
  })
  .get<{ postId: string; forumId: string }>("/:postId", (ctx) => {
    ctx.response.body =
      `Forum: ${ctx.params.forumId}, Post: ${ctx.params.postId}`;
  });

const forums = new Router()
  .get("/forums/:forumId/posts", posts.routes(), posts.allowedMethods());

console.log(
  `Responds to "http://localhost:8000/forums/oak/posts" and "http://localhost:8000/forums/oak/posts/nested-routers"`,
);

await new Application()
  .use(forums.routes())
  .listen({ port: 8000 });
