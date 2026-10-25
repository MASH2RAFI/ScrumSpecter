import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { RoutinesClient } from "./client";

const RoutinesPage = async () => {
    const user = await getCurrent();
    if (!user) redirect("/sign-in");

    return <RoutinesClient />;
};

export default RoutinesPage;
