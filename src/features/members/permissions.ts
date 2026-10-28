import { TaskStatus } from "@/features/tasks/types";

import { MemberRole } from "./types";

// What each role may do. Used by the API (which enforces it) and by the UI (which only hides
// what wouldn't be allowed anyway).
//
//                         Admin  Supervisor  Reviewer  Assignee  Viewer
//   see everything          ✓        ✓          ✓         ✓        ✓
//   status of own tasks     ✓        ✓          ✓      up to In Review
//   approve → Done / back   ✓        ✓          ✓
//   status of any task      ✓        ✓          ✓
//   create/edit/delete      ✓        ✓
//     tasks, routines,
//     projects, bulk input
//   members, roles, invites,
//     settings, holidays    ✓

export const ROLE_LABELS: Record<MemberRole, string> = {
    [MemberRole.ADMIN]: "Admin",
    [MemberRole.SUPERVISOR]: "Supervisor",
    [MemberRole.REVIEWER]: "Reviewer",
    [MemberRole.ASSIGNEE]: "Assignee",
    [MemberRole.VIEWER]: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
    [MemberRole.ADMIN]: "Everything, including members, invites and settings",
    [MemberRole.SUPERVISOR]: "Creates, edits and assigns tasks, routines and projects",
    [MemberRole.REVIEWER]: "Approves work to Done or sends it back; any task's status",
    [MemberRole.ASSIGNEE]: "Works on their own tasks, up to In Review",
    [MemberRole.VIEWER]: "Sees everything, changes nothing",
};

const is = (role: MemberRole | null | undefined, ...roles: MemberRole[]) => Boolean(role && roles.includes(role));

// Members, roles, invites, workspace settings and holidays
export const canManageWorkspace = (role?: MemberRole | null) => is(role, MemberRole.ADMIN);

// Create, edit and delete tasks, routines and projects; assign people; bulk input
export const canEditWork = (role?: MemberRole | null) => is(role, MemberRole.ADMIN, MemberRole.SUPERVISOR);

// Any task's status, including approving to Done or sending work back
export const canReview = (role?: MemberRole | null) => is(role, MemberRole.ADMIN, MemberRole.SUPERVISOR, MemberRole.REVIEWER);

// Whether this member may move a task from one status to another
export const canSetStatus = (
    role: MemberRole | null | undefined,
    { isAssignee, from, to }: { isAssignee: boolean; from: TaskStatus; to: TaskStatus },
) => {
    if (canReview(role)) return true;
    // Assignees work on their own tasks, but approval (Done) is someone else's call
    return is(role, MemberRole.ASSIGNEE) && isAssignee && from !== TaskStatus.DONE && to !== TaskStatus.DONE;
};

// The description of a task (notes while working on it)
export const canEditDescription = (role: MemberRole | null | undefined, isAssignee: boolean) =>
    canReview(role) || (is(role, MemberRole.ASSIGNEE) && isAssignee);

// Who can be given tasks and routines (viewers only watch)
export const canBeAssigned = (role?: MemberRole | null) => !is(role, MemberRole.VIEWER);

// Proposing task changes for an admin or supervisor to approve: for those who can't make them
// directly (assignees and reviewers)
export const canRequestChanges = (role?: MemberRole | null) => is(role, MemberRole.REVIEWER, MemberRole.ASSIGNEE);
