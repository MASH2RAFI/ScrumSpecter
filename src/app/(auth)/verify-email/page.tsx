import { VerifyEmailCard } from "@/features/auth/components/verify-email-card";

interface VerifyEmailPageProps {
    searchParams: Promise<{ token?: string }>;
}

const VerifyEmailPage = async (props: VerifyEmailPageProps) => {
    const searchParams = await props.searchParams;
    return (<VerifyEmailCard token={searchParams.token ?? null} />);
};

export default VerifyEmailPage;
