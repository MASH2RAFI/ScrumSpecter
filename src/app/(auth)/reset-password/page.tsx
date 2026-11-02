import { ResetPasswordCard } from "@/features/auth/components/password-reset-cards";

interface ResetPasswordPageProps {
    searchParams: Promise<{ token?: string }>;
}

const ResetPasswordPage = async (props: ResetPasswordPageProps) => {
    const searchParams = await props.searchParams;
    return (<ResetPasswordCard token={searchParams.token ?? null} />);
};

export default ResetPasswordPage;
