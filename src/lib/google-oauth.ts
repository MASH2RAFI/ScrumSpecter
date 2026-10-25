import "server-only";

import { createHash, randomBytes } from "crypto";

// OAuth 2.0 authorization code flow with PKCE against Google's OpenID Connect endpoints
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "google-oauth-state";
export const GOOGLE_VERIFIER_COOKIE = "google-oauth-verifier";

export type GoogleProfile = {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
};

export const isGoogleAuthEnabled = () =>
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = () => `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

const randomToken = () => randomBytes(32).toString("base64url");

export const createAuthorizationRequest = () => {
    const state = randomToken();
    const codeVerifier = randomToken();
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
    }).toString();

    return { url: url.toString(), state, codeVerifier };
};

// Exchanges the callback code for the user's verified Google profile
export const fetchGoogleProfile = async (code: string, codeVerifier: string): Promise<GoogleProfile> => {
    const tokenResponse = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            code_verifier: codeVerifier,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: redirectUri(),
            grant_type: "authorization_code",
        }),
    });

    if (!tokenResponse.ok) {
        throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
    }

    const { access_token } = await tokenResponse.json() as { access_token: string };

    const profileResponse = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileResponse.ok) {
        throw new Error(`Google userinfo failed: ${profileResponse.status}`);
    }

    return profileResponse.json() as Promise<GoogleProfile>;
};
