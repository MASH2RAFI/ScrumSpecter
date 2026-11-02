import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { StarredClient } from "./client";

const StarredPage = async () => {
    const user = await getCurrent();
    if (!user) redirect("/sign-in");

    return <StarredClient />;
};

export default StarredPage;
