
import { getCurrent } from "@/features/auth/queries";
import { redirectHome } from "@/features/workspaces/redirect-home";
import { SignInCard } from "@/features/auth/components/sign-in-card";
import { redirect } from "next/navigation";

import { isGoogleAuthEnabled } from "@/lib/google-oauth";
import { safeNextPath } from "@/lib/safe-next";

interface SignInPageProps {
    searchParams: Promise<{ error?: string; next?: string; link?: string; email?: string }>;
}

const SignInPage = async (props: SignInPageProps) => {
    const searchParams = await props.searchParams;
    const user = await getCurrent();

    const next = safeNextPath(searchParams.next);
    if (user) return next ? redirect(next) : redirectHome(user.$id);

    return <SignInCard googleEnabled={isGoogleAuthEnabled()} error={searchParams.error} next={next} linkGoogleEmail={searchParams.link === "google" ? searchParams.email : undefined} />;
};

export default SignInPage;
