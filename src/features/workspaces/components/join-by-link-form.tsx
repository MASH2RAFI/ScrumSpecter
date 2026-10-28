"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The workspace id and code in an invite link: …/workspaces/{workspaceId}/join/{inviteCode}
export const parseInviteLink = (link: string) => {
    const match = link.trim().match(/workspaces\/([^/?#\s]+)\/join\/([^/?#\s]+)/);
    if (!match) return null;
    try {
        return { workspaceId: match[1], code: decodeURIComponent(match[2]) };
    } catch {
        // A broken %-escape in the pasted code
        return null;
    }
};

// Paste an invite link to join; used on the getting-started page and in the sidebar's join popup
export const JoinByLinkForm = ({ onCancel, onJoined }: { onCancel?: () => void; onJoined?: () => void }) => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [link, setLink] = useState("");
    const [pending, setPending] = useState(false);

    const join = async (e: React.FormEvent) => {
        e.preventDefault();
        const invite = parseInviteLink(link);
        if (!invite) {
            toast.error("That doesn't look like an invite link. It ends in /join/ and a code.");
            return;
        }
        setPending(true);
        try {
            const response = await fetch(`/api/workspaces/${invite.workspaceId}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: invite.code }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                // The server says why: wrong code, expired, used up, already a member
                toast.error(body.error ?? "Couldn't join that workspace");
                return;
            }
            toast.success("Joined the workspace");
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            setLink("");
            onJoined?.();
            // Joined either way; without the id in the reply, "/" goes to the latest workspace
            const joinedId: unknown = body?.data?.$id;
            router.push(typeof joinedId === "string" ? `/workspaces/${joinedId}` : "/");
        } catch {
            toast.error("Couldn't join that workspace. Check your connection and try again.");
        } finally {
            setPending(false);
        }
    };

    return (
        <form onSubmit={join} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="invite-link">Invite link</Label>
                <Input
                    id="invite-link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://scrumspecter.vercel.app/workspaces/…/join/…"
                    disabled={pending}
                    autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">Ask an admin of the workspace for its invite link.</p>
            </div>
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
                )}
                <Button type="submit" disabled={pending || !link.trim()}>
                    {pending ? "Joining…" : "Join workspace"}
                </Button>
            </div>
        </form>
    );
};
