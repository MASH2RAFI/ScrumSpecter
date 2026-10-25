
import { getCurrent } from "@/features/auth/queries";
import { redirectHome } from "@/features/workspaces/redirect-home";
import { SignInCard } from "@/features/auth/components/sign-in-card";
import { isGoogleAuthEnabled } from "@/lib/google-oauth";

interface SignInPageProps {
    searchParams: { error?: string };
}

const SignInPage = async ({ searchParams }: SignInPageProps) => {
    const user = await getCurrent();

    if (user) return redirectHome(user.$id);

    return <SignInCard googleEnabled={isGoogleAuthEnabled()} error={searchParams.error} />;
};

export default SignInPage;
