
import { getCurrent } from "@/features/auth/queries";
import { redirectHome } from "@/features/workspaces/redirect-home";
import { SignUpCard } from "@/features/auth/components/sign-up-card";
import { isGoogleAuthEnabled } from "@/lib/google-oauth";

interface SignUpPageProps {
    searchParams: { error?: string };
}

const SignUpPage = async ({ searchParams }: SignUpPageProps) => {
    const user = await getCurrent();

    if (user) return redirectHome(user.$id);

    return <SignUpCard googleEnabled={isGoogleAuthEnabled()} error={searchParams.error} />;
};

export default SignUpPage;
