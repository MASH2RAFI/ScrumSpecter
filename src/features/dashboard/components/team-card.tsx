"use client";

import { UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ROLE_LABELS } from "@/features/members/permissions";
import type { Member } from "@/features/members/types";
import { useWorkspacePanel } from "@/features/workspaces/hooks/use-workspace-panel";

// Who's in the workspace and how much each has on their plate
export const TeamCard = ({ members, openByMember }: { members: Member[]; openByMember: Record<string, number> }) => {
    const { open } = useWorkspacePanel();
    const openCount = (memberId: string) => openByMember[memberId] ?? 0;
    const rows = members
        .map((member) => ({ member, open: openCount(member.$id) }))
        .sort((a, b) => b.open - a.open || a.member.name.localeCompare(b.member.name))
        .slice(0, 6);

    return (
        <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <UsersIcon className="size-5 text-primary" aria-hidden />
                        <h2 className="text-lg font-semibold">Team</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => open("members")}>
                        {members.length > rows.length ? `All ${members.length}` : "Manage"}
                    </Button>
                </div>
                <ul className="space-y-1">
                    {rows.map(({ member, open: count }) => (
                        <li key={member.$id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent/60">
                            <MemberAvatar name={member.name} className="size-9" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {member.name}
                                    {member.isPlaceholder && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(not joined)</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                                {count} open
                            </span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};
