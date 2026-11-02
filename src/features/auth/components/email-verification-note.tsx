"use client";

import { useState } from "react";
import { MailWarningIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppQuery } from "@/lib/use-app-query";
import { client } from "@/lib/rpc";

// Shown to accounts whose email isn't verified yet (a soft gate: the app still works)
export const EmailVerificationNote = () => {
    const [pending, setPending] = useState(false);
    const { data } = useAppQuery({
        queryKey: ["email-verification"],
        queryFn: async () => {
            const response = await client.api.auth["email-verification"].$get();
            if (!response.ok) throw new Error("Failed to load email status");
            return (await response.json()).data;
        },
    });

    if (!data || data.verified) return null;

    const resend = async () => {
        setPending(true);
        try {
            const response = await client.api.auth["email-verification"].resend.$post();
            const body = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(body.error ?? "Couldn't send the email");
            toast.success("Verification email sent");
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setPending(false);
        }
    };

    return (
        <div role="status" data-testid="email-unverified" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <MailWarningIcon className="size-4 shrink-0 text-amber-600" aria-hidden />
            <p className="flex-1 min-w-0">Your email isn&apos;t verified yet. Open the link we emailed you to confirm it.</p>
            <Button size="sm" variant="outline" onClick={resend} disabled={pending}>
                {pending ? "Sending..." : "Resend email"}
            </Button>
        </div>
    );
};
