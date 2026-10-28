// Where to go after signing in: only paths on this site, never the API or another host
export const safeNextPath = (next: string | null | undefined) =>
    next && /^\/(?![/\\])/.test(next) && !next.startsWith("/api") && next.length <= 512 ? next : null;
