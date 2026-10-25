# ScrumSpecter Refactor Plan

Status: done (2026-10-25)
Rollback snapshot of the pre-refactor tree: `pre-refactor-snapshot.tgz` in the session scratchpad.

## Goal
Clean up the whole codebase (~18k lines) **without changing behaviour**: same routes, same UI, same API JSON, same DB schema. Remove legacy and redundant code, deduplicate, simplify, and normalise style.

## Ground rules (every agent)
1. **Behaviour-preserving.** No visual changes, no new features, no changed copy (except removing dead copy).
2. **Frozen contracts.**
   - The API paths, methods, inputs and JSON response shapes in `src/features/*/server/route.ts` must stay exactly the same. The frontend's types are inferred from them through `hono/client` (`src/lib/rpc.ts`). The one exception is removing the dead analytics endpoints (Compartment A).
   - The DB schema (`src/lib/db/schema.ts`, `drizzle/`) must not change.
   - Exported names and signatures of files **you don't own** must not change. If you need a change elsewhere, list it under "Cross-compartment requests" in your report and don't make it yourself.
3. **Stay in your files.** Only edit, create or delete files your compartment owns.
4. **No shared-state commands.**
   - No `npm install` or `uninstall`, `next build`, `next dev`, or git commands that write (commit, stash, checkout, reset).
   - Verify with `npx tsc --noEmit` and `npx next lint --dir <your dirs>`. Fix errors in your files only; errors in other compartments' files may come from parallel work, so ignore them.
5. **Style.**
   - Match the surrounding code: 4-space indent in app code, and leave the shadcn files in `src/components/ui` at their 2-space style.
   - Fix stray spacing like `databases. listDocuments(` and `c. json (`.
   - Keep comments sparse and only where the code isn't self-explanatory.
6. **No new dependencies.** List any dependency your changes make unused in your report. Compartment A owns `package.json`.

## Compartments

### A — Backend & platform (`backend`)
Owns:
- `src/lib/**` except `src/lib/utils.ts` and `src/lib/sprint-utils.ts`
- `src/app/api/**`
- `src/features/*/server/**`, `src/features/*/queries.ts`, `src/features/*/schemas.ts`, `src/features/*/types.ts`, `src/features/members/utils.ts`
- `drizzle.config.ts`, `next.config.mjs`, `package.json`, `.env.example`, `README.md`

Tasks:
- Remove the dead analytics endpoints (`GET /workspaces/:id/analytics`, `GET /projects/:id/analytics`) and `src/lib/db/task-analytics.ts`. No client calls them.
- Deduplicate route boilerplate: the repeated "load row → 404 → getMember → 401 → admin check" sequence becomes small helpers (for example `requireMember`, `requireAdmin`, `getTaskById`, `getProjectById`, `getWorkspace`). Keep the status codes and error strings the same.
- Remove `isAdmin` if it ends up unused, and drop unused imports and types. Keep `src/lib/db/types.ts` `toDoc`/`Document` as the single document mapper.
- Clean up `types.ts` and `schemas.ts`: remove unused schemas (for example `createProjectSchema` and `updateProjectSchema` if only the form schemas are used), and make sure the empty `src/features/personal-todos/types.ts` is handled. Compartment C owns personal-todos, so ask C instead of deleting it.
- `package.json`: once the other agents report which dependencies are unused, the integrator removes them. You may move `@types/react-big-calendar` to devDependencies.
- `next.config.mjs`: remove `swcMinify`, which is the default in Next 14 (the key is dead).

### B — Tasks UI (`tasks-ui`)
Owns: `src/features/tasks/{api,components,hooks}/**`, including both calendar CSS files.

Tasks:
- `create-task-form.tsx` (543 lines) and `edit-task-form.tsx` (335 lines) are near-duplicates. Extract the shared fields into one component, or a shared fields module, used by both. The UI and validation must stay identical.
- `data-calendar.css` (915 lines) and `react-big-calendar.css` (818 lines) overlap. Remove duplicate, dead and overridden rules. The calendar must look exactly the same.
- `data-calendar.tsx`, `multiple-tasks-popup.tsx`, `grouped-event-card.tsx`, `event-card.tsx`: simplify, and remove direct DOM queries where React state works the same.
- Rename `kancan-column-header.tsx` to `kanban-column-header.tsx` and update its imports. The imports are inside B's files.
- Delete the unused `date-tooltip.tsx`.
- In `api/*` hooks: drop the invalidations of the removed `project-analytics` and `workspace-analytics` query keys, and deduplicate the repeated mutation boilerplate where it reads clearly.
- Remove stray `console.log`s.

### C — Workspaces, projects, members, auth, personal todos UI (`features-ui`)
Owns:
- `src/features/{workspaces,projects,members,auth}/{api,components,hooks}/**`
- `src/features/personal-todos/**`
- `src/components/personal-todo-list.tsx`

Tasks:
- Delete the unused hooks `workspaces/api/use-create-workspace.ts`, `workspaces/api/use-get-workspace-analytics.ts` and `projects/api/use-get-project-analytics.ts`, after confirming they're unused.
- `create-project-form.tsx` and `edit-project-form.tsx` duplicate each other, as do the workspace forms. Share the field blocks.
- `personal-todo-list.tsx` (444 lines) and `personal-todos/context` (unused): delete the dead context and the empty `types.ts` if nothing uses them, and simplify the widget. Keep its localStorage key `personal-todos` so existing users keep their todos.
- `members-list.tsx`, `edit-workspace-form.tsx`, `sign-in-card.tsx`, `sign-up-card.tsx`: dedupe and simplify.
- In `api/*` hooks: normalise style and dedupe boilerplate. The `RequestType` and `ResponseType` inference must keep working.

### D — App shell, routes & shared components (`app-shell`)
Owns:
- `src/app/**` except `src/app/api/**`
- `src/components/**` except `src/components/personal-todo-list.tsx`
- `src/hooks/**`, `src/lib/utils.ts`, `src/lib/sprint-utils.ts`
- `tailwind.config.ts`, `src/app/globals.css`

Tasks:
- Delete unused components after confirming with grep: `components/date-picker.tsx` (superseded by `simple-date-picker.tsx`), `components/theme-toggle.tsx`, `components/ui/{chart,icon,progress,scroll-area,skeleton}.tsx`. Report the dependencies this frees (`recharts`, `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`, `@radix-ui/react-icons`).
- `analytics/components/*` (sprint-report-generator, burndown-chart, velocity-tracker, capacity-calculator): extract the shared sprint and task math into `src/lib/sprint-utils.ts`, and dedupe.
- `app/(dashboard)/workspaces/[workspaceId]/client.tsx` (307 lines) and the other `client.tsx` pages: extract repeated loading and error handling and repeated card markup.
- `about-content.tsx` (758 lines): move the data arrays out of the JSX into constants and remove repetition. The rendered page must stay the same.
- `performance-monitor.tsx`: remove it if it only logs to the console in production (dev-only noise), together with its use in `app/layout.tsx`.
- Remove stray `console.log`s and unused imports.

## Integration (main session, after A–D report)
1. `npx tsc --noEmit`, `npx next lint`, `npx next build`, all clean.
2. Apply the cross-compartment requests.
3. Remove the dependencies reported as unused, then run `npm install`.
4. Run the API smoke test against a local test Postgres (register/login/workspaces/projects/tasks/bulk/members/leave/delete), which must show the same results as before.
5. Run a code review of the full diff (the `/code-review` skill) and fix what it confirms.
6. Show the summary to the user. Deploying is a separate decision.

## Progress
| Compartment | Agent | Status |
|---|---|---|
| A Backend & platform | backend | done |
| B Tasks UI | tasks-ui | done |
| C Features UI | features-ui | done |
| D App shell | app-shell | done |
| Integration | main session | done: tsc/lint/build clean, 44/44 API smoke + 17 review-fix checks, 13/13 pages render, /code-review findings fixed |
