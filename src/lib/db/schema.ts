import {
    bigint,
    boolean,
    date,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

import { MemberRole } from "../../features/members/types";
import { TaskStatus } from "../../features/tasks/types";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());

const timestamps = {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
};

export const memberRole = pgEnum("member_role", MemberRole);

export const taskStatus = pgEnum("task_status", TaskStatus);

export const users = pgTable(
    "users",
    {
        id: id(),
        name: text("name").notNull(),
        email: text("email").notNull(),
        // Null for accounts that only sign in with Google
        passwordHash: text("password_hash"),
        googleId: text("google_id"),
        // UserPreferences (src/features/auth/preferences.ts); missing keys use the defaults
        preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
        ...timestamps,
    },
    (t) => [
        uniqueIndex("users_email_idx").on(t.email),
        uniqueIndex("users_google_id_idx").on(t.googleId),
    ]
);

export const sessions = pgTable(
    "sessions",
    {
        // sha256 of the cookie token, never the raw token
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        // Shown in Account settings → Security so people can recognise and sign out devices
        userAgent: text("user_agent"),
        ipAddress: text("ip_address"),
        // "Dhaka, BD", from Vercel's geolocation headers
        location: text("location"),
        lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    },
    (t) => [index("sessions_user_idx").on(t.userId)]
);

export const workspaces = pgTable(
    "workspaces",
    {
        id: id(),
        name: text("name").notNull(),
        inviteCode: text("invite_code").notNull(),
        // A second link that joins people as viewers (read-only)
        viewerInviteCode: text("viewer_invite_code"),
        userId: text("user_id").notNull(),
        // Invite link limits: null = never expires / unlimited
        inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
        inviteMaxUses: integer("invite_max_uses"),
        inviteUses: integer("invite_uses").notNull().default(0),
        // Working day ("HH:MM", local to each person): frames the routine week overview, and
        // tasks with only a date are due by its end
        workDayStart: text("work_day_start").notNull().default("09:00"),
        workDayEnd: text("work_day_end").notNull().default("18:00"),
        // Country code for public holidays (date-holidays); null = none
        holidayCountry: text("holiday_country").default("BD"),
        // Bumped by database triggers on any change to the workspace's data, so clients
        // can keep their cache until it moves (see drizzle/0004_data_versions_holidays.sql)
        dataVersion: bigint("data_version", { mode: "number" }).notNull().default(0),
        ...timestamps,
    },
    (t) => [index("workspaces_user_idx").on(t.userId)]
);

export const holidayKind = pgEnum("holiday_kind", ["custom", "hidden"]);

// Custom days off, and public holidays an admin has hidden
export const workspaceHolidays = pgTable(
    "workspace_holidays",
    {
        id: id(),
        workspaceId: text("workspace_id")
            .notNull()
            .references(() => workspaces.id, { onDelete: "cascade" }),
        date: date("date").notNull(),
        name: text("name").notNull(),
        kind: holidayKind("kind").notNull(),
        ...timestamps,
    },
    (t) => [uniqueIndex("workspace_holidays_day_idx").on(t.workspaceId, t.date, t.kind)]
);

export const members = pgTable(
    "members",
    {
        id: id(),
        workspaceId: text("workspace_id")
            .notNull()
            .references(() => workspaces.id, { onDelete: "cascade" }),
        // null for a placeholder: someone tasks can be assigned to before they join
        userId: text("user_id")
            .references(() => users.id, { onDelete: "cascade" }),
        role: memberRole("role").notNull(),
        // Placeholders only: shown name, and the email that hands its tasks over on joining
        placeholderName: text("placeholder_name"),
        placeholderEmail: text("placeholder_email"),
        ...timestamps,
    },
    (t) => [
        // Several placeholders (null user ids) don't collide here: Postgres treats nulls as distinct
        uniqueIndex("members_workspace_user_idx").on(t.workspaceId, t.userId),
        index("members_user_idx").on(t.userId),
    ]
);

export const projects = pgTable(
    "projects",
    {
        id: id(),
        name: text("name").notNull(),
        workspaceId: text("workspace_id")
            .notNull()
            .references(() => workspaces.id, { onDelete: "cascade" }),
        sprintDuration: integer("sprint_duration"),
        sprintNumber: integer("sprint_number"),
        // stored as YYYY-MM-DD strings, as the client sends them
        currentSprintStartDate: text("current_sprint_start_date"),
        currentSprintEndDate: text("current_sprint_end_date"),
        startingSprintDate: text("starting_sprint_date"),
        ...timestamps,
    },
    (t) => [index("projects_workspace_idx").on(t.workspaceId)]
);

export const tasks = pgTable(
    "tasks",
    {
        id: id(),
        name: text("name").notNull(),
        status: taskStatus("status").notNull(),
        workspaceId: text("workspace_id")
            .notNull()
            .references(() => workspaces.id, { onDelete: "cascade" }),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        // Member ids (people or placeholders); not foreign keys, and kept in step by member
        // removal and placeholder hand-over
        assigneeIds: text("assignee_ids").array().notNull().default(sql`'{}'::text[]`),
        position: integer("position").notNull(),
        dueDate: timestamp("due_date", { withTimezone: true }),
        // Optional time block; null means an all-day task on its due date
        startAt: timestamp("start_at", { withTimezone: true }),
        durationMinutes: integer("duration_minutes"),
        description: text("description"),
        storyPoints: integer("story_points"),
        sprintId: text("sprint_id"),
        // Set when the task was generated by a weekly routine
        routineId: text("routine_id").references(() => routines.id, { onDelete: "set null" }),
        ...timestamps,
    },
    (t) => [
        // One task per routine per day, so generation can safely run more than once
        uniqueIndex("tasks_routine_due_idx").on(t.routineId, t.dueDate),
        index("tasks_workspace_idx").on(t.workspaceId),
        index("tasks_project_status_idx").on(t.projectId, t.status),
        index("tasks_assignees_idx").using("gin", t.assigneeIds),
    ]
);

export const routines = pgTable(
    "routines",
    {
        id: id(),
        name: text("name").notNull(),
        description: text("description"),
        workspaceId: text("workspace_id")
            .notNull()
            .references(() => workspaces.id, { onDelete: "cascade" }),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        // Member ids, like tasks.assignee_ids; every generated task gets all of them
        assigneeIds: text("assignee_ids").array().notNull().default(sql`'{}'::text[]`),
        storyPoints: integer("story_points"),
        // ISO weekdays, 1 = Monday ... 7 = Sunday
        weekdays: integer("weekdays").array().notNull(),
        // Optional "HH:MM" in timeZone (IANA), so 10:00 means 10:00 where it was set; null = all day
        startTime: text("start_time"),
        timeZone: text("time_zone"),
        durationMinutes: integer("duration_minutes"),
        active: boolean("active").notNull().default(true),
        // Which task views list this routine's tasks (Home and My work always do)
        showInTable: boolean("show_in_table").notNull().default(true),
        showInKanban: boolean("show_in_kanban").notNull().default(true),
        showInCalendar: boolean("show_in_calendar").notNull().default(true),
        ...timestamps,
    },
    (t) => [index("routines_workspace_idx").on(t.workspaceId)]
);

// One row per device/browser that allowed notifications (Web Push)
export const pushSubscriptions = pgTable(
    "push_subscriptions",
    {
        id: id(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        endpoint: text("endpoint").notNull(),
        p256dh: text("p256dh").notNull(),
        auth: text("auth").notNull(),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    },
    (t) => [
        uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint),
        index("push_subscriptions_user_idx").on(t.userId),
    ]
);

export const notificationKind = pgEnum("notification_kind", ["day_before", "before_end", "test", "change_request", "change_reviewed"]);

// Reminders sent to a user: the in-app bell's history, and (via dedupeKey) a record that stops
// the same reminder going out twice
export const notifications = pgTable(
    "notifications",
    {
        id: id(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
        taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
        kind: notificationKind("kind").notNull(),
        title: text("title").notNull(),
        body: text("body").notNull(),
        url: text("url"),
        scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
        dedupeKey: text("dedupe_key").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        readAt: timestamp("read_at", { withTimezone: true }),
    },
    (t) => [
        uniqueIndex("notifications_dedupe_idx").on(t.dedupeKey),
        index("notifications_user_created_idx").on(t.userId, t.createdAt),
    ]
);

// Failed sign-in attempts per email and per IP, so guessing passwords gets locked out on every
// server instance alike
export const loginAttempts = pgTable("login_attempts", {
    // "email:<address>" or "ip:<address>"
    key: text("key").primaryKey(),
    failures: integer("failures").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

// "Forgot password" links: single-use, short-lived
export const passwordResets = pgTable(
    "password_resets",
    {
        // sha256 of the emailed token, never the token itself
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        usedAt: timestamp("used_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [index("password_resets_user_idx").on(t.userId)]
);

export const changeRequestKind = pgEnum("change_request_kind", ["create", "update", "delete"]);
export const changeRequestStatus = pgEnum("change_request_status", ["pending", "approved", "declined"]);

// A task change proposed by someone who can't make it directly (an assignee); an admin or
// supervisor approves it (which applies it) or declines it
export const changeRequests = pgTable(
    "change_requests",
    {
        id: id(),
        workspaceId: text("workspace_id")
            .notNull()
            .references(() => workspaces.id, { onDelete: "cascade" }),
        requesterId: text("requester_id")
            .notNull()
            .references(() => members.id, { onDelete: "cascade" }),
        kind: changeRequestKind("kind").notNull(),
        // The task to change or delete; null for a new task (and once a deleted task is gone)
        taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
        // The task's name when asked, so the request still reads well if the task goes away
        taskName: text("task_name").notNull(),
        // The proposed fields (create: all of them; update: only those that change)
        changes: jsonb("changes").$type<Record<string, unknown>>().notNull().default({}),
        note: text("note"),
        status: changeRequestStatus("status").notNull().default("pending"),
        reviewerId: text("reviewer_id").references(() => members.id, { onDelete: "set null" }),
        reviewNote: text("review_note"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    },
    (t) => [
        index("change_requests_workspace_status_idx").on(t.workspaceId, t.status),
        index("change_requests_requester_idx").on(t.requesterId),
    ]
);
