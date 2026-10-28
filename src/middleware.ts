import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE } from "@/features/auth/constants";

const PUBLIC_ROUTES = ["/about", "/privacy", "/terms", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

// Sends visitors without a session cookie to /about (or to sign in, for a deeper link) before
// any page renders.
// Only checks that the cookie exists (no DB call); pages validate the session themselves.
export function middleware(request: NextRequest) {
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

    return NextResponse.next();
}

export const config = {
    // Everything except the API, Next internals and static files
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
