"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrent } from "@/features/auth/api/use-current";
import { PageLoader } from "@/components/page-loader";

interface AuthGuardProps {
    children: React.ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const { data: user, isLoading } = useCurrent();
    const [isClient, setIsClient] = useState(false);

    // Public routes that don't require authentication
    const publicRoutes = ["/about", "/sign-in", "/sign-up"];
    const isPublicRoute = publicRoutes.includes(pathname);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient || isLoading) return;

        // If user is not authenticated
        if (!user) {
            // If not on a public route, redirect to about page
            if (!isPublicRoute) {
                router.push("/about");
            }
            return;
        }

        // If user is authenticated
        if (user) {
            // If on public routes (about, sign-in, sign-up), redirect to home
            if (isPublicRoute) {
                router.push("/");
            }
            // If on home page, let the home page handle workspace routing
            return;
        }
    }, [user, isLoading, isClient, pathname, router, isPublicRoute]);

    // Show loading while checking authentication
    if (!isClient || isLoading) {
        return <PageLoader />;
    }

    // If user is not authenticated and on a public route, show the page
    if (!user && isPublicRoute) {
        return <>{children}</>;
    }

    // If user is authenticated and not on a public route, show the page
    if (user && !isPublicRoute) {
        return <>{children}</>;
    }

    // Show loading during redirects
    return <PageLoader />;
};
