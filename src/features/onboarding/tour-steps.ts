import { canEditWork, canManageWorkspace, canRequestChanges, canReview, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/features/members/permissions";
import { MemberRole } from "@/features/members/types";

export type TourStep = {
    id: string;
    // data-tour value of the element to point at; none (or not on screen) shows the card centred
    target?: string;
    title: string;
    body: string;
};

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const withArticle = (word: string) => `${/^[AEIOU]/.test(word) ? "an" : "a"} ${word}`;

// The tour explains what this person's role lets them do, so each role gets its own wording
export const buildTourSteps = ({ name, role, workspaceName }: { name: string; role: MemberRole; workspaceName?: string }): TourStep[] => {
    const firstName = name.trim().split(/\s+/)[0] || "there";
    const editor = canEditWork(role);
    const requester = canRequestChanges(role);
    const roleLabel = ROLE_LABELS[role];
    const where = workspaceName ? ` in ${workspaceName}` : "";

    const tasksBody = editor
        ? "Every task in the workspace, as a table, a kanban board or a calendar. Press C anywhere to create one."
        : canReview(role)
            ? "Every task in the workspace, as a table, a kanban board or a calendar. You can move any task, including approving work to Done or sending it back."
            : role === MemberRole.ASSIGNEE
                ? "Every task in the workspace, as a table, a kanban board or a calendar. Move your own tasks along up to In Review; a reviewer then approves them to Done."
                : "Every task in the workspace, as a table, a kanban board or a calendar. You can look at everything, but not change it.";

    const steps: (TourStep | false)[] = [
        {
            id: "welcome",
            title: `Welcome to ScrumSpecter, ${firstName}!`,
            body: `You're ${withArticle(roleLabel)}${where}: ${ROLE_DESCRIPTIONS[role].toLowerCase()}. This short tour shows you around.`,
        },
        {
            id: "home",
            target: "nav-home",
            title: "Home",
            body: "Your day at a glance: what's overdue, due today and due tomorrow, with a countdown to each task's end time.",
        },
        { id: "tasks", target: "nav-my-tasks", title: "My Tasks", body: tasksBody },
        {
            id: "routines",
            target: "nav-routines",
            title: "Routines",
            body: editor
                ? "Set up tasks that repeat every week. They're created for you on their days, through the end of the sprint."
                : "Tasks that repeat every week. They turn up in My Tasks on their days.",
        },
        editor && {
            id: "requests",
            target: "nav-requests",
            title: "Requests",
            body: "When assignees or reviewers want a task added, changed or deleted, their request lands here for you to approve or decline. The badge counts the ones waiting.",
        },
        requester && {
            id: "requests",
            target: "nav-requests",
            title: "Requests",
            body: "Want a task added, changed or removed? Edit it as usual and press Send request, or pick Request deletion. An admin or supervisor decides, and you'll find the answer here.",
        },
        {
            id: "members",
            target: "nav-members",
            title: "Members",
            body: canManageWorkspace(role)
                ? "See who's here and change their roles. Invite people from Settings → Invites; there's a separate link for view-only Viewers."
                : "Everyone in this workspace and their roles.",
        },
        {
            id: "analytics",
            target: "nav-analytics",
            title: "Analytics",
            body: "Burndown, capacity and sprint reports for each project.",
        },
        {
            id: "notifications",
            target: "notifications",
            title: "Notifications",
            body: "Reminders, approvals and changes to your tasks show up here.",
        },
        {
            id: "account",
            target: "account",
            title: "Your account",
            body: "Your name, password, time zone and preferences, like the default task view and when to be reminded.",
        },
        {
            id: "done",
            title: "You're all set",
            body: `Press ${isMac() ? "⌘" : "Ctrl"} K to jump to any page, project or task, and ? to see every shortcut. You can replay this tour from the quick-jump menu or your account menu.`,
        },
    ];

    return steps.filter((step): step is TourStep => Boolean(step));
};
