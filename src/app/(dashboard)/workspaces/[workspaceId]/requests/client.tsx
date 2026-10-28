"use client";

import { Stagger, StaggerItem } from "@/components/motion";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckIcon, GitPullRequestArrowIcon, Undo2Icon, XIcon } from "lucide-react";

import { PageError } from "@/components/page-error";
import { PageSkeleton } from "@/components/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, snakeCaseToTitleCase } from "@/lib/utils";
import {
    useGetChangeRequests,
    useReviewChangeRequest,
    useWithdrawChangeRequest,
} from "@/features/change-requests/api/use-change-requests";
import { ChangeRequest } from "@/features/change-requests/types";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useTaskPanel } from "@/features/tasks/hooks/use-task-panel";
import { formatDuration, formatTimeRange } from "@/features/tasks/task-time";
import { Task } from "@/features/tasks/types";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

const KIND_LABELS = { create: "New task", update: "Change", delete: "Delete" } as const;
const KIND_STYLES = {
    create: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    update: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    delete: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
} as const;

const dateLabel = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "No date";

type Lookup = { project: (id: string) => string; people: (ids: string[]) => string };

// Each proposed field as "Label: before → after" (before only for changes to an existing task)
const describe = (request: ChangeRequest, current: Task | undefined, { project, people }: Lookup) => {
    const { changes } = request;
    const rows: { label: string; before?: string; after: string }[] = [];
    const add = (label: string, after: string, before?: string) =>
        rows.push({ label, after, before: request.kind === "update" ? before : undefined });

    if (changes.name !== undefined && request.kind === "update") add("Name", changes.name, current?.name);
    if (changes.projectId !== undefined) add("Project", project(changes.projectId), current && project(current.projectId));
    if (changes.assigneeIds !== undefined) add("Assignees", people(changes.assigneeIds), current && people(current.assigneeIds));
    if (changes.status !== undefined) add("Status", snakeCaseToTitleCase(changes.status));
    if (changes.dueDate !== undefined) add("Due", dateLabel(changes.dueDate), current && dateLabel(current.dueDate));
    if (changes.startAt !== undefined) {
        add(
            "Time",
            changes.startAt ? `${formatTimeRange(changes.startAt, changes.durationMinutes)} (${formatDuration(changes.durationMinutes)})` : "All day",
            current && (current.startAt ? formatTimeRange(current.startAt, current.durationMinutes) : "All day"),
        );
    }
    if (changes.storyPoints !== undefined) add("Points", String(changes.storyPoints), current?.storyPoints != null ? String(current.storyPoints) : "None");
    if (changes.description !== undefined) add("Description", changes.description || "(empty)");
    return rows;
};

const RequestCard = ({ request, current, lookup, canReview, isMine }: {
    request: ChangeRequest; current?: Task; lookup: Lookup; canReview: boolean; isMine: boolean;
}) => {
    const [reply, setReply] = useState("");
    const { mutate: review, isPending: isReviewing } = useReviewChangeRequest();
    const { mutate: withdraw, isPending: isWithdrawing } = useWithdrawChangeRequest();
    const { open: openTask } = useTaskPanel();
    const rows = describe(request, current, lookup);
    const pending = request.status === "pending";

    return (
        <Card aria-label={`${KIND_LABELS[request.kind]}: ${request.taskName}`}>
            <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", KIND_STYLES[request.kind])}>
                                {KIND_LABELS[request.kind]}
                            </span>
                            {request.taskId ? (
                                <button type="button" onClick={() => openTask(request.taskId!)} className="truncate text-left font-semibold hover:underline">
                                    {request.taskName}
                                </button>
                            ) : (
                                <span className="truncate font-semibold">{request.taskName}</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isMine ? "You" : request.requesterName} asked {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                    </div>
                    {!pending && (
                        <Badge variant={request.status === "approved" ? "secondary" : "outline"}>
                            {request.status === "approved" ? "Approved" : "Declined"}
                            {request.reviewerName ? ` by ${request.reviewerName}` : ""}
                        </Badge>
                    )}
                </div>

                {rows.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        {rows.map((row) => (
                            <div key={row.label} className="contents">
                                <dt className="text-muted-foreground">{row.label}</dt>
                                <dd className="min-w-0 break-words">
                                    {row.before !== undefined && (
                                        <><span className="text-muted-foreground line-through">{row.before}</span>{" → "}</>
                                    )}
                                    {row.after}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}

                {request.note && <p className="border-l-2 pl-3 text-sm italic">{request.note}</p>}
                {request.reviewNote && (
                    <p className="border-l-2 border-primary pl-3 text-sm">
                        <span className="text-muted-foreground">{request.reviewerName ?? "Reviewer"}: </span>{request.reviewNote}
                    </p>
                )}

                {pending && canReview && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder="Reply (optional)"
                            maxLength={1000}
                            aria-label={`Reply to ${request.requesterName}`}
                            className="h-9"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" disabled={isReviewing}
                                onClick={() => review({ id: request.$id, decision: "approve", note: reply.trim() || undefined })}>
                                <CheckIcon className="mr-1 size-4" />
                                Approve
                            </Button>
                            <Button size="sm" variant="outline" disabled={isReviewing}
                                onClick={() => review({ id: request.$id, decision: "decline", note: reply.trim() || undefined })}>
                                <XIcon className="mr-1 size-4" />
                                Decline
                            </Button>
                        </div>
                    </div>
                )}
                {pending && isMine && !canReview && (
                    <Button size="sm" variant="ghost" disabled={isWithdrawing}
                        onClick={() => withdraw({ id: request.$id, workspaceId: request.workspaceId })}>
                        <Undo2Icon className="mr-1 size-4" />
                        Withdraw
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};

// Editors: requests waiting for them, then the history. Everyone else: their own requests.
export const RequestsClient = () => {
    const workspaceId = useWorkspaceId();
    const { canEditWork, memberId } = usePermissions({ workspaceId });
    const { data: requests, isLoading } = useGetChangeRequests({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });
    const { data: members } = useGetMembers({ workspaceId });
    const { data: tasks } = useGetTasks({ workspaceId });

    if (isLoading) return <PageSkeleton />;
    if (!requests) return <PageError message="Failed to load change requests" />;

    const lookup: Lookup = {
        project: (id) => projects?.documents.find((project) => project.$id === id)?.name ?? "Unknown project",
        people: (ids) => ids.map((id) => members?.documents.find((member) => member.$id === id)?.name ?? "Someone").join(", ") || "Nobody",
    };
    const taskById = new Map((tasks?.documents ?? []).map((task) => [task.$id, task as Task]));
    const waiting = requests.filter((request) => request.status === "pending");
    const reviewed = requests.filter((request) => request.status !== "pending");

    const list = (items: ChangeRequest[]) => (
        // New requests rise in as they arrive
        <Stagger className="space-y-3">
            {items.map((request) => (
                <StaggerItem key={request.$id}>
                    <RequestCard
                        request={request}
                        current={request.taskId ? taskById.get(request.taskId) : undefined}
                        lookup={lookup}
                        canReview={canEditWork}
                        isMine={request.requesterId === memberId}
                    />
                </StaggerItem>
            ))}
        </Stagger>
    );

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
                {canEditWork
                    ? "Assignees and reviewers ask here to add, change or delete tasks. Approving applies the change."
                    : "Changes you asked for. An admin or supervisor approves or declines them; you're notified either way."}
            </p>

            <section className="space-y-3">
                <h2 className="font-semibold">Waiting for review {waiting.length > 0 && <span className="text-muted-foreground">({waiting.length})</span>}</h2>
                {waiting.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                            <GitPullRequestArrowIcon className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                {canEditWork ? "Nothing to review." : "No open requests. Edit a task, or use New, to ask for a change."}
                            </p>
                        </CardContent>
                    </Card>
                ) : list(waiting)}
            </section>

            {reviewed.length > 0 && (
                <section className="space-y-3">
                    <h2 className="font-semibold">Reviewed</h2>
                    {list(reviewed)}
                </section>
            )}
        </div>
    );
};
