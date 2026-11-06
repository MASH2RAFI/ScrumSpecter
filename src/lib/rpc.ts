import { hc } from "hono/client";
import { AppType } from "@/app/api/[[...route]]/route";
import { batchedFetch } from "@/lib/batch-fetch";

// Page-load GETs travel together (see batch-fetch.ts)
export const client = hc<AppType>(process.env.NEXT_PUBLIC_APP_URL!, { fetch: batchedFetch });
