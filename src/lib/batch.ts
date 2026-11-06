// Which requests may travel together in one POST /api/batch. Shared by the server (what it will run)
// and the browser (what it will bundle). Only GETs of JSON endpoints a page load needs: never the
// exports (files and streams), the cron jobs, sign-in and the like, or the batch itself.
export const MAX_BATCH = 24;

const BATCHABLE = /^\/api\/(?:auth\/(?:current|email-verification)|account(?:\/sessions)?|workspaces(?:\/[\w-]+(?:\/(?:holidays|info))?)?|projects(?:\/[\w-]+)?|members(?:\/is-admin)?|tasks(?:\/[\w-]+)?|routines|change-requests|stars\/ids|notifications(?:\/subscriptions)?)\/?$/;

export const isBatchablePath = (pathname: string) => BATCHABLE.test(pathname);
