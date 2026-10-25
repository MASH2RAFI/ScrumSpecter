"use client";

import { UserButton } from "@/features/auth/components/user-button";
import { NeuralBackground } from "@/components/neural-background";
import { PersonalTodoWidget } from "@/components/personal-todo-list";
import { ThemeLogo } from "@/components/theme-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface StandloneLayoutProps {
    children: React.ReactNode;
}

const StandloneLayout = ({ children }: StandloneLayoutProps) => {
    const pathname = usePathname();
    // Public pages get sign-in/sign-up buttons instead of the user menu
    const isPublicPage = ["/about", "/privacy", "/terms"].includes(pathname);

    return (
        <main className="bg-background min-h-screen">
            {/* Decorative network only on the public pages, never behind working UI */}
            {isPublicPage && <NeuralBackground />}
            <div className="mx-auto max-w-screen-2xl p-4">

                <nav className="flex justify-between items-center h-[73px]">
                    {!isPublicPage ? (
                        <>
                            <Link href="/">
                                <ThemeLogo height={50} width={100} />
                            </Link>
                            <div className="flex items-center gap-2">
                                <PersonalTodoWidget />
                                <UserButton />
                            </div>
                        </>
                    ) : (
                        <>
                            <Link href="/about">
                                <ThemeLogo height={50} width={100} />
                            </Link>
                            <div className="flex items-center gap-2">
                                <Button asChild variant="outline">
                                    <Link href="/sign-in">Sign In</Link>
                                </Button>
                                <Button asChild>
                                    <Link href="/sign-up">Sign Up</Link>
                                </Button>
                            </div>
                        </>
                    )}
                </nav>

                <div className="flex flex-col items-center justify-center py-4">
                    {children}
                </div>
            </div>
        </main>
    );
}
export default StandloneLayout;