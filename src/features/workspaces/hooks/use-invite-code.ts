import { useParams } from "next/navigation";

export const useInviteCode = () => {
    const params = useParams();
    // useParams keeps percent-encoding, so an "@" in older codes arrives as "%40"
    return decodeURIComponent(params.inviteCode as string);
};