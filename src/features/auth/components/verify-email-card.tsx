"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { client } from "@/lib/rpc";

// A button rather than verifying on load, so a mail scanner opening the link can't use it up
export const VerifyEmailCard = ({ token }: { token: string | null }) => {
    const queryClient = useQueryClient();
    const [state, setState] = useState<"idle" | "pending" | "done">("idle");
    const [error, setError] = useState<string | null>(null);

    const verify = async () => {
        if (!token) return;
        setState("pending");
        setError(null);
        const response = await client.api.auth["verify-email"].$post({ json: { token } }).catch(() => null);
        if (response?.ok) {
            setState("done");
            queryClient.invalidateQueries({ queryKey: ["email-verification"] });
            return;
        }
        const body = await response?.json().catch(() => ({})) as { error?: string } | undefined;
        setError(body?.error ?? "Couldn't verify the email. Try again.");
        setState("idle");
    };

    return (
        <Card className="w-full max-w-md mx-auto border-0 shadow-2xl">
            <CardHeader className="text-center p-8 pb-4">
                <CardTitle className="text-2xl font-bold">
                    {state === "done" ? "Email verified" : token ? "Verify your email" : "Verification link missing"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    {state === "done"
                        ? "Thanks, your email address is confirmed."
                        : token
                            ? "Confirm this is your email address."
                            : "Open the link from the email again, or sign in and ask for a new one."}
                </p>
            </CardHeader>
            <CardContent className="p-8 pt-2 space-y-4">
                {state !== "done" && token && (
                    <Button size="lg" className="w-full" onClick={verify} disabled={state === "pending"}>
                        {state === "pending" ? "Verifying..." : "Verify my email"}
                    </Button>
                )}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <p className="text-center text-sm">
                    <Link href="/" className="text-primary hover:underline">Go to ScrumSpecter</Link>
                </p>
            </CardContent>
        </Card>
    );
};
