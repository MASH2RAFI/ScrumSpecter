"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

import "./globals.css";

// Replaces the root layout when it fails, so it brings its own <html> and <body>
const GlobalError = ({ reset }: { error: Error & { digest?: string }; reset: () => void }) => {
    return (
        <html lang="en">
            <body className="antialiased min-h-screen">
                <div className="h-screen flex flex-col gap-y-4 items-center justify-center">
                    <AlertTriangle className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Something went wrong</p>
                    <div className="flex gap-x-2">
                        <Button variant="secondary" size="sm" onClick={reset}>
                            Try again
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                            {/* A full page load, since the app's layout is what broke */}
                            <a href="/">Back to home</a>
                        </Button>
                    </div>
                </div>
            </body>
        </html>
    );
};

export default GlobalError;
