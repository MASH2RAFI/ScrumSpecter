// Relative, not "@/lib/batch": e2e/batch-fetch.spec.ts loads this file straight from Node, where on some versions the
// @/ alias fails the first time (seen in CI on Node 22: "Cannot find module '@/lib/batch'")
import { isBatchablePath, MAX_BATCH } from "./batch";

// A page load asks for a dozen things at once. In the browser, GETs that are made within a few
// milliseconds of each other travel together in one POST /api/batch, and every caller still gets
// its own Response, as if it had made the request alone. Anything else, one lone request included,
// goes out as usual; if the batch itself fails, each request is simply made on its own.
const WINDOW_MS = 6;

type Pending = {
    url: string;
    signal: AbortSignal | null;
    resolve: (response: Response) => void;
    reject: (reason: unknown) => void;
};

let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

// Requests sent ahead of the page that will want them (see primeRequests), by URL
const PRIME_TTL = 20_000;
const primed = new Map<string, Promise<Response>>();

const aborted = () => new DOMException("The operation was aborted.", "AbortError");

const alone = (item: Pending) => fetch(item.url, { signal: item.signal }).then(item.resolve, item.reject);

const sendBatch = async (items: Pending[]) => {
    try {
        const response = await fetch("/api/batch", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requests: items.map((item) => item.url) }),
        });
        if (!response.ok) throw new Error(`batch ${response.status}`);
        const { results } = (await response.json()) as { results: { status: number; type: string; body: string }[] };
        if (results.length !== items.length) throw new Error("batch size");
        items.forEach((item, index) => {
            if (item.signal?.aborted) return item.reject(aborted());
            const { status, type, body } = results[index];
            item.resolve(new Response(status === 204 ? null : body, { status, headers: { "content-type": type } }));
        });
    } catch {
        // The batch itself failed: ask for each one on its own, as if it had never been batched
        items.forEach((item) => (item.signal?.aborted ? item.reject(aborted()) : void alone(item)));
    }
};

// One batch, or a few when there are more than the server takes; a lone request goes out as usual
const send = (items: Pending[]) => {
    if (items.length === 1) void alone(items[0]);
    for (let start = 0; items.length > 1 && start < items.length; start += MAX_BATCH) void sendBatch(items.slice(start, start + MAX_BATCH));
};

const flush = () => {
    const items = queue.filter((item) => !item.signal?.aborted);
    queue = [];
    timer = undefined;
    send(items);
};

// Asks for these now, in one batch, because a page that needs them is about to open (the sign-in
// that is about to land on the home page). When that page makes the same request, it gets this answer
// instead of asking again; each answer is handed out once, and dropped unused after a few seconds.
export const primeRequests = (urls: string[]) => {
    if (typeof window === "undefined") return;
    const items: Pending[] = [];
    for (const url of new Set(urls)) {
        if (primed.has(url)) continue;
        const promise = new Promise<Response>((resolve, reject) => items.push({ url, signal: null, resolve, reject }));
        promise.catch(() => {});
        primed.set(url, promise);
        setTimeout(() => primed.delete(url), PRIME_TTL);
    }
    send(items);
};

// Another person may use this browser next: nothing sent ahead for the last one is kept
export const clearPrimed = () => primed.clear();

// Signing out: the session ends and the page is about to be replaced, so any read still being
// started (a refresh that follows an edit, a tab coming back) would only meet a 401. From here
// reads wait, unanswered, until the page goes; a failed sign-out lets them go again.
let reading = true;
const held: (() => void)[] = [];
export const stopReading = () => {
    reading = false;
    // A read that joined the queue a moment ago would be sent after the sign-out request, and meet
    // its 401 (seen: a version check sent 5 ms after the sign-out): hold those too
    clearTimeout(timer);
    timer = undefined;
    held.push(...queue.splice(0).map((item) => () => {
        queue.push(item);
        timer ??= setTimeout(flush, WINDOW_MS);
    }));
};
export const resumeReading = () => {
    reading = true;
    // Reads asked for meanwhile are sent now, so nothing stays loading after a sign-out that failed
    held.splice(0).forEach((release) => release());
};

type Early = { urls: string[]; json: Promise<{ results: { status: number; type: string; body: string }[] } | null> };

// The HTML of a workspace's Home starts its requests before this code has downloaded (early-data.tsx
// on the server); the answers are taken up here, once, as if they had been primed.
let earlyAdopted = false;
const adoptEarly = () => {
    earlyAdopted = true;
    const early = (window as unknown as { __early?: Early }).__early;
    if (!early) return;
    early.urls.forEach((url, index) => {
        const promise = early.json.then((json) => {
            const result = json?.results[index];
            // The early batch failed: ask for this one on its own
            return result ? new Response(result.status === 204 ? null : result.body, { status: result.status, headers: { "content-type": result.type } }) : fetch(url);
        });
        promise.catch(() => {});
        primed.set(url, promise);
        setTimeout(() => primed.delete(url), PRIME_TTL);
    });
};

export const batchedFetch: typeof fetch = (input, init) => {
    if (typeof window === "undefined") return fetch(input, init);
    if (!earlyAdopted) adoptEarly();
    const request = input instanceof Request ? input : null;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const target = new URL(request ? request.url : String(input), window.location.origin);
    if (method !== "GET" || target.origin !== window.location.origin || !isBatchablePath(target.pathname)) {
        return fetch(input, init);
    }
    if (!reading) return new Promise<Response>((resolve, reject) => { held.push(() => batchedFetch(input, init).then(resolve, reject)); });

    const early = primed.get(target.pathname + target.search);
    if (early) {
        primed.delete(target.pathname + target.search);
        return early;
    }

    const signal = init?.signal ?? request?.signal ?? null;
    if (signal?.aborted) return Promise.reject(aborted());
    return new Promise<Response>((resolve, reject) => {
        const item: Pending = { url: target.pathname + target.search, signal, resolve, reject };
        signal?.addEventListener("abort", () => {
            queue = queue.filter((queued) => queued !== item);
            reject(aborted());
        }, { once: true });
        queue.push(item);
        timer ??= setTimeout(flush, WINDOW_MS);
    });
};
