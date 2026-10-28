"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearPersistedCache } from "@/lib/query-cache";
import { client } from "@/lib/rpc";

const errorOf = async (response: Response, fallback: string) =>
    ((await response.json().catch(() => ({}))) as { error?: string }).error ?? fallback;

const Shell = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <Card className="w-full max-w-md mx-auto border-0 shadow-2xl">
        <CardHeader className="text-center p-8 pb-4">
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="p-8 pt-2 space-y-4">{children}</CardContent>
    </Card>
);

export const ForgotPasswordCard = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
            const response = await client.api.auth["forgot-password"].$post({ json: { email } });
            if (!response.ok) throw new Error(await errorOf(response, "Something went wrong. Try again."));
            setMessage((await response.json()).data.message);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setPending(false);
        }
    };

    return (
        <Shell title="Forgot your password?" description="We'll email you a link to choose a new one.">
            {message ? (
                <p role="status" className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                    </div>
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" size="lg" className="w-full" disabled={pending}>
                        {pending ? "Sending..." : "Email me a link"}
                    </Button>
                </form>
            )}
            <p className="text-center text-sm">
                <Link href="/sign-in" className="text-primary hover:underline">Back to sign in</Link>
            </p>
        </Shell>
    );
};

export const ResetPasswordCard = ({ token }: { token: string | null }) => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    if (!token) {
        return (
            <Shell title="Reset link missing" description="Open the link from the email again, or ask for a new one.">
                <Button asChild size="lg" className="w-full"><Link href="/forgot-password">Ask for a new link</Link></Button>
            </Shell>
        );
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (password !== confirm) {
            setError("The passwords don't match");
            return;
        }
        setPending(true);
        setError(null);
        try {
            const response = await client.api.auth["reset-password"].$post({ json: { token, password } });
            if (!response.ok) throw new Error(await errorOf(response, "Couldn't reset the password"));
            // Signed in as the account owner now: start from a clean cache
            clearPersistedCache();
            queryClient.clear();
            router.replace("/");
            router.refresh();
        } catch (e) {
            setError((e as Error).message);
            setPending(false);
        }
    };

    return (
        <Shell title="Choose a new password" description="You'll be signed out everywhere else.">
            <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required
                        value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required
                        value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}{" "}
                        {error.includes("expired") && <Link href="/forgot-password" className="underline">Ask for a new link</Link>}
                    </p>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={pending}>
                    {pending ? "Saving..." : "Save new password"}
                </Button>
            </form>
        </Shell>
    );
};
