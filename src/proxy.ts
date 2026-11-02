import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, LAST_WORKSPACE_COOKIE } from "@/features/auth/constants";

const PUBLIC_ROUTES = ["/about", "/privacy", "/terms", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email"];

// Enforced CSP with a fresh nonce per page: Next adds it to its own scripts (it reads it from the
// request's CSP header) and the root layout passes it to next-themes' inline script.
// 'strict-dynamic' lets those scripts load the app's chunks. Inline style attributes (motion,
// next-themes) need 'unsafe-inline' for styles only. React's dev tools need eval in development.
const contentSecurityPolicy = (nonce: string) => [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join("; ");

const WORKSPACE_PATH = /^\/workspaces\/([\w-]+)(?:\/|$)/;
const NOT_WORKSPACE_IDS = ["create", "join"];

// Sends visitors without a session cookie to /about (or to sign in, for a deeper link) before
// any page renders.
// Only checks that the cookie exists (no DB call); pages validate the session themselves.
export function proxy(request: NextRequest) {
    const isPublicRoute = PUBLIC_ROUTES.includes(request.nextUrl.pathname);

    if (!isPublicRoute && !request.cookies.has(AUTH_COOKIE)) {
        // The home page introduces the app; anything deeper (an invite or a shared task link)
        // asks to sign in and then comes back
        if (request.nextUrl.pathname === "/") {
            return NextResponse.redirect(new URL("/about", request.url));
        }
        const signIn = new URL("/sign-in", request.url);
        signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.redirect(signIn);
    }

    const nonce = btoa(crypto.randomUUID());
    const csp = contentSecurityPolicy(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);

    // Remember the workspace opened last, so "/" reopens it (redirectHome checks membership).
    // A link prefetch isn't an open, so it doesn't count
    const workspaceId = request.nextUrl.pathname.match(WORKSPACE_PATH)?.[1];
    if (workspaceId && !NOT_WORKSPACE_IDS.includes(workspaceId)
        && !request.headers.has("next-router-prefetch")
        && request.cookies.get(LAST_WORKSPACE_COOKIE)?.value !== workspaceId) {
        response.cookies.set(LAST_WORKSPACE_COOKIE, workspaceId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        });
    }

    return response;
}

export const config = {
    // Everything except the API, Next internals and static files
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
