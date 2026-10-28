"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/hooks/use-confirm";
import { usePermissions } from "@/features/members/hooks/use-permissions";

import { Workspace } from "../types";
import { useUpdateWorkspace } from "../api/use-update-workspace";
import { useDeleteWorkspace } from "../api/use-delete-workspace";
import { useResetInviteCode } from "../api/use-reset-invite-code";
import { useResetViewerInviteCode } from "../api/use-reset-viewer-invite-code";
import { BulkInput } from "./bulk-input";
import { HolidaySettings } from "./holiday-settings";
import { InviteByEmail } from "./invite-by-email";
import { InviteLimits } from "./invite-limits";

const Section = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
    <section className="space-y-3 rounded-lg border p-4">
        <div>
            <h3 className="font-semibold">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
    </section>
);

// Name and working hours
const GeneralSettings = ({ workspace, isAdmin }: { workspace: Workspace; isAdmin: boolean }) => {
    const { mutate, isPending } = useUpdateWorkspace();
    const [name, setName] = useState(workspace.name);
    const [dayStart, setDayStart] = useState(workspace.workDayStart ?? "09:00");
    const [dayEnd, setDayEnd] = useState(workspace.workDayEnd ?? "18:00");
    const hoursInvalid = dayStart >= dayEnd;
    const changed = name.trim() !== workspace.name || dayStart !== workspace.workDayStart || dayEnd !== workspace.workDayEnd;

    const save = (event: FormEvent) => {
        event.preventDefault();
        if (hoursInvalid) return;
        mutate({
            param: { workspaceId: workspace.$id },
            form: { name: name.trim(), workDayStart: dayStart, workDayEnd: dayEnd },
        });
    };

    return (
        <form onSubmit={save} className="space-y-4">
            <Section title="Workspace name">
                <Label htmlFor="workspace-name" className="sr-only">Workspace name</Label>
                <Input id="workspace-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} required maxLength={80} />
            </Section>

            <Section
                title="Working hours"
                description="Frames the routine week overview. Tasks with only a date are due by the end of the day, for reminders and the move to Backlog."
            >
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="work-day-start">Day starts</Label>
                        <Input id="work-day-start" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value || dayStart)}
                            disabled={!isAdmin} className="w-32" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="work-day-end">Day ends</Label>
                        <Input id="work-day-end" type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value || dayEnd)}
                            disabled={!isAdmin} className="w-32" aria-invalid={hoursInvalid} />
                    </div>
                </div>
                {hoursInvalid && <p role="alert" className="text-xs text-destructive">The day has to end after it starts.</p>}
            </Section>

            {isAdmin && (
                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending || !changed || hoursInvalid}>Save changes</Button>
                </div>
            )}
        </form>
    );
};

// A link with copy and (admins) reset buttons
const LinkField = ({ label, link, canReset, resetting, onReset }: {
    label: string; link: string; canReset: boolean; resetting: boolean; onReset: () => void;
}) => {
    const [ResetDialog, confirmReset] = useConfirm(
        `Reset ${label.toLowerCase()}`,
        "The current link stops working and a new one is made.",
        "destructive",
    );

    return (
        <div className="flex items-center gap-2">
            <ResetDialog />
            <Input readOnly value={link} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
            <Button
                variant="secondary"
                size="icon"
                className="shrink-0"
                aria-label={`Copy ${label.toLowerCase()}`}
                onClick={() => navigator.clipboard.writeText(link).then(() => toast.success(`${label} copied`))}
            >
                <CopyIcon className="size-4" />
            </Button>
            {canReset && (
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Reset ${label.toLowerCase()}`}
                    title={`Reset ${label.toLowerCase()}`}
                    disabled={resetting}
                    onClick={async () => {
                        if (await confirmReset()) onReset();
                    }}
                >
                    <RefreshCwIcon className="size-4" />
                </Button>
            )}
        </div>
    );
};

// The invite links: copy them, limit the regular one, email it, or replace them
const InviteSettings = ({ workspace, isAdmin }: { workspace: Workspace; isAdmin: boolean }) => {
    const { mutate: resetInviteCode, isPending } = useResetInviteCode();
    const { mutate: resetViewerCode, isPending: isResettingViewer } = useResetViewerInviteCode();
    const joinLink = (code: string) => `${window.location.origin}/workspaces/${workspace.$id}/join/${code}`;
    const inviteLink = joinLink(workspace.inviteCode);

    return (
        <div className="space-y-4">
            <Section title="Invite link" description="Anyone with this link joins as an Assignee. An admin can change their role afterwards.">
                <LinkField
                    label="Invite link"
                    link={inviteLink}
                    canReset={isAdmin}
                    resetting={isPending}
                    onReset={() => resetInviteCode({ param: { workspaceId: workspace.$id } })}
                />
                <InviteLimits workspace={workspace} canEdit={isAdmin} />
            </Section>

            {/* Only admins see it: anyone holding it can see everything in the workspace */}
            {isAdmin && (
                <Section title="Viewer link" description="Anyone with this link joins as a Viewer: they see everything and change nothing.">
                    {workspace.viewerInviteCode ? (
                        <LinkField
                            label="Viewer link"
                            link={joinLink(workspace.viewerInviteCode)}
                            canReset
                            resetting={isResettingViewer}
                            onReset={() => resetViewerCode({ param: { workspaceId: workspace.$id } })}
                        />
                    ) : (
                        <Button variant="outline" disabled={isResettingViewer}
                            onClick={() => resetViewerCode({ param: { workspaceId: workspace.$id } })}>
                            Create a viewer link
                        </Button>
                    )}
                </Section>
            )}

            <Section title="Email an invitation">
                <InviteByEmail workspace={workspace} inviteLink={inviteLink} />
            </Section>
        </div>
    );
};

const DangerZone = ({ workspace }: { workspace: Workspace }) => {
    const router = useRouter();
    const { mutate: deleteWorkspace, isPending } = useDeleteWorkspace();
    const [DeleteDialog, confirmDelete] = useConfirm(
        "Delete workspace",
        "Every project, task and routine in it is deleted. This can't be undone.",
        "destructive",
    );

    return (
        <Section title="Delete workspace" description="Removes the workspace and everything in it for all members.">
            <DeleteDialog />
            <Button
                variant="destructive"
                disabled={isPending}
                onClick={async () => {
                    if (!(await confirmDelete())) return;
                    deleteWorkspace({ param: { workspaceId: workspace.$id } }, { onSuccess: () => router.push("/") });
                }}
            >
                Delete {workspace.name}
            </Button>
        </Section>
    );
};

// Settings popup (sidebar → Settings), one tab per area
export const WorkspaceSettings = ({ workspace }: { workspace: Workspace }) => {
    const { isAdmin: admin, canEditWork } = usePermissions({ workspaceId: workspace.$id });

    return (
        <div className="space-y-4 p-6">
            <h2 className="text-xl font-bold">{workspace.name} settings</h2>
            <Tabs defaultValue="general">
                <TabsList className="grid h-auto w-full grid-cols-3 sm:grid-cols-5">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="invites">Invites</TabsTrigger>
                    <TabsTrigger value="holidays">Holidays</TabsTrigger>
                    <TabsTrigger value="bulk" disabled={!canEditWork}>Bulk input</TabsTrigger>
                    <TabsTrigger value="danger" disabled={!admin}>Danger zone</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="pt-2">
                    <GeneralSettings key={workspace.$updatedAt} workspace={workspace} isAdmin={admin} />
                </TabsContent>
                <TabsContent value="invites" className="pt-2">
                    <InviteSettings workspace={workspace} isAdmin={admin} />
                </TabsContent>
                <TabsContent value="holidays" className="pt-2">
                    <HolidaySettings workspaceId={workspace.$id} isAdmin={admin} />
                </TabsContent>
                {canEditWork && (
                    <TabsContent value="bulk" className="pt-2">
                        <BulkInput workspace={workspace} canManage={admin} />
                    </TabsContent>
                )}
                {admin && (
                    <TabsContent value="danger" className="pt-2">
                        <DangerZone workspace={workspace} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};
