"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useUpdateInviteLimits } from "../api/use-update-invite-limits";
import { Workspace } from "../types";

const EXPIRY = [
    { value: "never", label: "Never", days: null },
    { value: "1", label: "1 day", days: 1 },
    { value: "7", label: "7 days", days: 7 },
    { value: "30", label: "30 days", days: 30 },
] as const;

const USES = [
    { value: "unlimited", label: "Unlimited", uses: null },
    { value: "1", label: "1 person", uses: 1 },
    { value: "5", label: "5 people", uses: 5 },
    { value: "10", label: "10 people", uses: 10 },
    { value: "25", label: "25 people", uses: 25 },
] as const;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// How long the invite link works and for how many people; shown to everyone, set by admins
export const InviteLimits = ({ workspace, canEdit }: { workspace: Workspace; canEdit: boolean }) => {
    const { mutate, isPending } = useUpdateInviteLimits();
    const expired = workspace.inviteExpiresAt !== null && new Date(workspace.inviteExpiresAt).getTime() <= Date.now();
    const usedUp = workspace.inviteMaxUses !== null && workspace.inviteUses >= workspace.inviteMaxUses;

    const status = [
        workspace.inviteExpiresAt
            ? `${expired ? "Expired" : "Expires"} ${shortDate(workspace.inviteExpiresAt)}`
            : "Never expires",
        workspace.inviteMaxUses !== null
            ? `${workspace.inviteUses} of ${workspace.inviteMaxUses} ${workspace.inviteMaxUses === 1 ? "place" : "places"} used`
            : `${workspace.inviteUses} joined`,
    ].join(" · ");

    return (
        <div className="space-y-2">
            {canEdit && (
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="invite-expiry" className="text-sm">Expires</Label>
                        <Select
                            disabled={isPending}
                            value={workspace.inviteExpiresAt ? "keep" : "never"}
                            onValueChange={(value) => {
                                const days = EXPIRY.find((option) => option.value === value)?.days ?? null;
                                mutate({ workspaceId: workspace.$id, expiresInDays: days });
                            }}
                        >
                            <SelectTrigger id="invite-expiry" className="h-9 w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {workspace.inviteExpiresAt && <SelectItem value="keep" disabled>As set</SelectItem>}
                                {EXPIRY.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.days ? `In ${option.label}` : option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="invite-uses" className="text-sm">Can be used by</Label>
                        <Select
                            disabled={isPending}
                            value={USES.find((option) => option.uses === workspace.inviteMaxUses)?.value ?? "unlimited"}
                            onValueChange={(value) => {
                                const uses = USES.find((option) => option.value === value)?.uses ?? null;
                                mutate({ workspaceId: workspace.$id, maxUses: uses });
                            }}
                        >
                            <SelectTrigger id="invite-uses" className="h-9 w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {USES.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
            <p className={expired || usedUp ? "text-xs text-destructive" : "text-xs text-muted-foreground"} role="status">
                {status}
                {(expired || usedUp) && canEdit && " · Reset the link or change the limits to invite more people."}
            </p>
        </div>
    );
};
