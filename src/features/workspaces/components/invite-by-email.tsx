"use client";

import { useState, type FormEvent } from "react";
import { MailIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrent } from "@/features/auth/api/use-current";

import { Workspace } from "../types";

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Opens a ready-written invite in Gmail (or the device's mail app) to send from your own account
export const InviteByEmail = ({ workspace, inviteLink }: { workspace: Workspace; inviteLink: string }) => {
    const { data: user } = useCurrent();
    const [to, setTo] = useState("");
    const [error, setError] = useState<string | null>(null);

    const recipients = to.split(/[\s,;]+/).map((address) => address.trim()).filter(Boolean);

    const message = () => {
        const subject = `Join ${workspace.name} on ScrumSpecter`;
        const limits = [
            workspace.inviteExpiresAt ? `The link works until ${new Date(workspace.inviteExpiresAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })}.` : null,
            workspace.inviteMaxUses ? `It can be used by ${workspace.inviteMaxUses} ${workspace.inviteMaxUses === 1 ? "person" : "people"}.` : null,
        ].filter(Boolean).join(" ");
        const body = [
            "Hi,",
            "",
            `${user?.name ?? "I"} invited you to the "${workspace.name}" workspace on ScrumSpecter.`,
            "",
            `Join here: ${inviteLink}`,
            ...(limits ? ["", limits] : []),
            "",
            "If you don't have an account yet, you can create one from that link.",
        ].join("\n");
        return { subject, body };
    };

    const valid = () => {
        if (recipients.length === 0 || !recipients.every((address) => EMAIL.test(address))) {
            setError("Enter one or more email addresses, separated by commas");
            return false;
        }
        setError(null);
        return true;
    };

    const openGmail = (event: FormEvent) => {
        event.preventDefault();
        if (!valid()) return;
        const { subject, body } = message();
        const url = new URL("https://mail.google.com/mail/");
        url.search = new URLSearchParams({ view: "cm", fs: "1", to: recipients.join(","), su: subject, body }).toString();
        window.open(url.toString(), "_blank", "noopener,noreferrer");
    };

    const openMailApp = () => {
        if (!valid()) return;
        const { subject, body } = message();
        window.location.href = `mailto:${recipients.map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <form onSubmit={openGmail} className="space-y-2" aria-label="Email an invitation">
            <Label htmlFor="invite-email">Invite by email</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    id="invite-email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com, another@example.com"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    aria-invalid={Boolean(error)}
                />
                <Button type="submit" className="shrink-0">
                    <MailIcon className="mr-1.5 size-4" />
                    Send with Gmail
                </Button>
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
                Opens a ready-written email in Gmail; you send it from your own account.{" "}
                <button type="button" onClick={openMailApp} className="text-primary hover:underline min-h-0 min-w-0">
                    Use another email app
                </button>
            </p>
        </form>
    );
};
