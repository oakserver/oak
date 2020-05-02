import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const data = new Map<string, string>();
const names = ["Brian", "Steve", "Evans", "Elvis"];
// Add some data to the Map
for (let i = 0; i < names.length; i++) {
  data.set((i + 1).toString(), names[i]);
}

const router = new Router();

router
  .get("/data", (context) => {
    context.response.body = Array.from(data);
  })
  .get("/data/:id", (context) => {
    let data_id = context.params.id!;
    context.response.body = { name: data.get(data_id) };
  })
  .post("/data", ({ request, response }) => {
    if (!request.hasBody) {
      response.status = 400;
      response.body = { msg: "Invalid data" };
    } else {
      response.body = { msg: "Success", data: request.body() };
    }
  });

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Listening on http://localhost:8080");
await app.listen({ port: 8080 });
