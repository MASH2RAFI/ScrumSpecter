import type { Context } from "hono";

// Where to go after signing in: only paths on this site, never the API or another host. Only plain URL characters are
// allowed (letters, digits and - . _ ~ / ? & = % : , + @ # ! * ' ( ), the ones encodeURIComponent leaves in a search text):
// a quote or angle bracket would break out of the page that continueTo writes it into, and a tab or newline is dropped by
// browsers, so "/<tab>/evil.com" would go to "//evil.com". continueTo escapes what it writes, so the apostrophe is safe.
const PLAIN_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~/?&=%:,+@#!*'()]*$/;

export const safeNextPath = (next: string | null | undefined) =>
    next && PLAIN_PATH.test(next) && !next.startsWith("/api") && next.length <= 512 ? next : null;

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A page that moves the browser to `path` with a same-site navigation (a plain redirect straight after Google's cross-site one
// would not carry a Strict cookie). The path is escaped for where it lands, so even an odd one cannot add markup. There is
// no script in it, only a refresh, so continuePage can forbid scripts outright.
export const continueTo = (path: string) =>
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(path)}">`;

// continueTo as a response. The API's pages get no Content-Security-Policy from src/proxy.ts (it skips /api), so this one
// says it runs nothing: a mistake that put markup in the page could not execute.
export const continuePage = (c: Context, path: string) => {
    c.header("Content-Security-Policy", "default-src 'none'");
    return c.html(continueTo(path));
};
