import { createHash } from "crypto";

import { expect, test } from "@playwright/test";

import { CACHE_BUSTER } from "../src/lib/query-cache";
import {
    CALENDAR_VIEWS, CALENDAR_VIEW_LABELS, DATE_FORMATS, DEFAULT_PREFERENCES, MAP_LIMITS, MAX_SLOT, MIN_SLOT, ROUTINE_TAGS, SLOT_STEP, TASK_SORTS, TASK_VIEWS,
} from "../src/features/auth/preferences-core";

// The browser keeps a saved copy of the data for up to 7 days and does not re-validate the preferences in it (the server
// does, before sending them). So when a preference's allowed values change (a calendar view removed or renamed...),
// CACHE_BUSTER must change in the same commit, or an old copy would show a value that no longer exists.
// This pins what the preferences allow to the buster they were last checked against: when they change, this fails
// until CACHE_BUSTER is changed and its new fingerprint is recorded below.
const KNOWN: Record<string, string> = {
    "2026-11-04.no-signed-out-copy": "7da8de49ab85",
};

const fingerprint = () => createHash("sha1").update(JSON.stringify({
    TASK_VIEWS, CALENDAR_VIEWS, CALENDAR_VIEW_LABELS, DATE_FORMATS, TASK_SORTS, ROUTINE_TAGS, MAP_LIMITS,
    SLOT: [SLOT_STEP, MIN_SLOT, MAX_SLOT], keys: Object.keys(DEFAULT_PREFERENCES).sort(),
})).digest("hex").slice(0, 12);

test("the saved copy's cache buster matches what the preferences allow", () => {
    expect(
        KNOWN[CACHE_BUSTER],
        `What preferences allow is now ${fingerprint()}. If you changed or removed a value, change CACHE_BUSTER (src/lib/query-cache.ts) and add\n"${CACHE_BUSTER}": "${fingerprint()}" for the new one here; if you only added a setting, the old buster stays and its fingerprint is updated here.`,
    ).toBe(fingerprint());
});
