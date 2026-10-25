"use client";

import { NeuralBackground } from "@/components/neural-background";
import { ThemeLogo } from "@/components/theme-logo";

interface AuthLayoutProps {
    children: React.ReactNode;
};

const AuthLayout = ( { children } : AuthLayoutProps) => {

    return (
        <main className="bg-background min-h-screen">
            <NeuralBackground />
            <div className="mx-auto max-w-screen-2xl p-4">
                <nav className="flex justify-center items-center">
                    <ThemeLogo width={100} height={50} />
                </nav>
                <div className="flex flex-col items-center justify-center pt-4 md:pt-14">
                    {children }
                </div>

            </div>
        </main>
    );
}

export default AuthLayout