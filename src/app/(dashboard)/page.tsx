
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { PageLoader } from "@/components/page-loader";

export default function Home() {
    const router = useRouter();
    const { data: workspaces, isLoading } = useGetWorkspaces();

    useEffect(() => {
        if (workspaces && !isLoading) {
            if (workspaces.total === 0) {
                router.push("/workspaces/create");
            } else {
                router.push(`/workspaces/${workspaces.documents[0].$id}`);
            }
        }
    }, [workspaces, isLoading, router]);

    return <PageLoader />;
}
