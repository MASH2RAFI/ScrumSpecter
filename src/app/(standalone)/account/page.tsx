import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ClientOnly } from "@/components/client-only";
import { CardPageSkeleton } from "@/components/page-skeletons";
import { getCurrent } from "@/features/auth/queries";
import { AccountSettings } from "@/features/account/components/account-settings";

const AccountPage = async () => {
    const user = await getCurrent();
    if (!user) redirect("/sign-in");

    // Reads cached data and search params (?tab=, ?google=), so it renders in the browser only
    return (
        <ClientOnly fallback={<CardPageSkeleton />}>
            <Suspense fallback={<CardPageSkeleton />}>
                <AccountSettings />
            </Suspense>
        </ClientOnly>
    );
};

export default AccountPage;
