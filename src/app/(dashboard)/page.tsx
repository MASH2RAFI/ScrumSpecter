import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { redirectHome } from "@/features/workspaces/redirect-home";

// Routes straight to the user's latest workspace on the server: no spinner, no client fetch
export default async function Home() {
    const user = await getCurrent();

    if (!user) redirect("/sign-in");

    return redirectHome(user.$id);
}
