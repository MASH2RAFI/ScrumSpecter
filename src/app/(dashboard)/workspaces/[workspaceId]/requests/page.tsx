import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { RequestsClient } from "./client";

const RequestsPage = async () => {
    const user = await getCurrent();
    if (!user) redirect("/sign-in");

    return <RequestsClient />;
};

export default RequestsPage;
