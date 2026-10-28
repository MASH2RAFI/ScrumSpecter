import { ResetPasswordCard } from "@/features/auth/components/password-reset-cards";

interface ResetPasswordPageProps {
    searchParams: { token?: string };
}

const ResetPasswordPage = ({ searchParams }: ResetPasswordPageProps) => (
    <ResetPasswordCard token={searchParams.token ?? null} />
);

export default ResetPasswordPage;
