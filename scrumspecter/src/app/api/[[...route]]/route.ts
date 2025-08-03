import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api");

app.get("/hello", (c) => {
    return c.json({hello:"World"});
});

app.get("/project/:projectID",  (c) => {
    const { projectID } = c.req.param();

    return c.json({project: projectID });
});

export const GET = handle(app);