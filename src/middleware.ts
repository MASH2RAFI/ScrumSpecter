import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE } from "@/features/auth/constants";

const PUBLIC_ROUTES = ["/about", "/privacy", "/terms", "/sign-in", "/sign-up"];

// Sends visitors without a session cookie to /about before any page renders.
// Only checks that the cookie exists (no DB call); pages validate the session themselves.
export function middleware(request: NextRequest) {
    const isPublicRoute = PUBLIC_ROUTES.includes(request.nextUrl.pathname);

    if (!isPublicRoute && !request.cookies.has(AUTH_COOKIE)) {
        return NextResponse.redirect(new URL("/about", request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Everything except the API, Next internals and static files
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
