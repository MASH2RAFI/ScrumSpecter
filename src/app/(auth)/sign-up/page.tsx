
import { getCurrent } from "@/features/auth/queries";
import { redirectHome } from "@/features/workspaces/redirect-home";
import { SignUpCard } from "@/features/auth/components/sign-up-card";
import { redirect } from "next/navigation";

import { isGoogleAuthEnabled } from "@/lib/google-oauth";
import { safeNextPath } from "@/lib/safe-next";

interface SignUpPageProps {
    searchParams: { error?: string; next?: string; link?: string; email?: string };
}

const SignUpPage = async ({ searchParams }: SignUpPageProps) => {
    const user = await getCurrent();

    const next = safeNextPath(searchParams.next);
    if (user) return next ? redirect(next) : redirectHome(user.$id);

    return <SignUpCard googleEnabled={isGoogleAuthEnabled()} error={searchParams.error} next={next} />;
};

export default SignUpPage;
