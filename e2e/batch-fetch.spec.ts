import { expect, test } from "@playwright/test";

// The browser's batching (src/lib/batch-fetch.ts), run here in Node with a stand-in fetch that records what is sent:
// reads made within a few milliseconds travel together, at most 24 to a batch, and every caller gets its own answer.
test.describe.configure({ mode: "serial" });

type Sent = { url: string; batch: string[] | null };
let sent: Sent[] = [];
let failBatches = false;

const answer = (url: string) => Response.json({ url });
const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/batch") {
        const requests = (JSON.parse(String(init?.body)) as { requests: string[] }).requests;
        sent.push({ url, batch: requests });
        if (failBatches) return new Response("", { status: 503 });
        return Response.json({ results: requests.map((asked) => ({ status: 200, type: "application/json", body: JSON.stringify({ url: asked }) })) });
    }
    sent.push({ url, batch: null });
    return answer(url);
};

const load = async () => {
    globals.window = { location: { origin: "http://localhost" } };
    globals.fetch = fakeFetch;
    return (await import("../src/lib/batch-fetch")).batchedFetch;
};

const path = (n: number) => `/api/projects?workspaceId=w${n}`;
const askFor = async (batchedFetch: Awaited<ReturnType<typeof load>>, count: number) => {
    const answers = await Promise.all(Array.from({ length: count }, (_, n) => batchedFetch(path(n)).then((response) => response.json())));
    // Each caller got the answer to its own request
    answers.forEach((answered, n) => expect(answered).toEqual({ url: path(n) }));
};

// The stand-ins are put back after, so a later spec in this worker sees the real ones
const globals = globalThis as unknown as Record<string, unknown>;
const originals = { window: globals.window, fetch: globals.fetch };
test.afterAll(() => {
    for (const [name, value] of Object.entries(originals)) {
        if (value === undefined) delete globals[name];
        else globals[name] = value;
    }
});

test.beforeEach(() => { sent = []; failBatches = false; });

test("30 reads at once travel as a batch of 24 and a batch of 6, each caller getting its own answer", async () => {
    await askFor(await load(), 30);
    expect(sent.map((call) => call.batch?.length)).toEqual([24, 6]);
    expect(sent.flatMap((call) => call.batch ?? [])).toEqual(Array.from({ length: 30 }, (_, n) => path(n)));
});

test("24 reads are one batch; 25 are 24 and 1", async () => {
    const batchedFetch = await load();
    await askFor(batchedFetch, 24);
    expect(sent.map((call) => call.batch?.length)).toEqual([24]);
    sent = [];
    await askFor(batchedFetch, 25);
    expect(sent.map((call) => call.batch?.length)).toEqual([24, 1]);
});

test("one lone read goes out as itself, not as a batch", async () => {
    await askFor(await load(), 1);
    expect(sent).toEqual([{ url: path(0), batch: null }]);
});

test("when the batch fails, each read is made on its own", async () => {
    failBatches = true;
    await askFor(await load(), 3);
    expect(sent.filter((call) => call.batch).length).toBe(1);
    expect(sent.filter((call) => !call.batch).map((call) => call.url).sort()).toEqual([0, 1, 2].map(path).sort());
});
