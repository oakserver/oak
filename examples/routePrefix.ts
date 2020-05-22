import {
  Application,
  Router,
} from "../mod.ts";
const router = new Router({
  prefix: "/prefix",
  // strict: true,
});

const port = 4000;

const server = new Application();

server.use(
  router.routes(),
  router.allowedMethods(),
);

router
  .get("/", ({ response }: { response: any }) => {
    response.status = 200;
    response.body = { msg: "Prefix works" };
  })
  .get(
    "/:id",
    ({ params, response }: { params: { id: string }; response: any }) => {
      response.body = `prefix w/ id: ${params.id}`;
    },
  )
  .get(
    "/test",
    ({ params, response }: { params: { id: string }; response: any }) => {
      response.body = `test`;
    },
  );

console.log("server running");

await server.listen({ port });
