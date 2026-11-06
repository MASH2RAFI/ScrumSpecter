import "server-only";

import { headers } from "next/headers";

import { getCurrent } from "@/features/auth/queries";
import { resolvePreferences } from "@/features/auth/preferences";
import { CACHE_BUSTER, CACHE_REFRESH_AFTER, CACHE_STORAGE_KEY } from "@/lib/query-cache";

import { homeRequestUrls } from "./home-requests";

// Opening a workspace's Home from a link, a bookmark or a reload: the page's code has to download
// before the page can ask for its data. This sends the same requests (one batch) from a tiny inline
// script as soon as the HTML arrives, and the page picks the answers up (see adoptEarly in
// batch-fetch.ts). It does nothing when the browser holds a saved copy under an hour old: that opens
// without asking, and the request would be wasted. An older copy is shown at once and refreshed
// behind it, and those requests are the ones started here.
// The script is built from ids and settings the server itself holds, never from the request, and
// is escaped for HTML. It runs under the page's nonce.
const HOME_PATH = /^\/workspaces\/([\w-]{8,64})\/?$/;
const NOT_WORKSPACES = ["create", "join"];

const escapeForScript = (json: string) => json.replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");

export const EarlyData = async () => {
    const requestHeaders = await headers();
    const workspaceId = requestHeaders.get("x-pathname")?.match(HOME_PATH)?.[1];
    // A prefetch isn't an open
    if (!workspaceId || NOT_WORKSPACES.includes(workspaceId) || requestHeaders.has("next-router-prefetch")) return null;

    const user = await getCurrent();
    if (!user) return null;
    const { weekStart, taskFilters, hiddenProjects, timeZone } = resolvePreferences(user.preferences);
    // The server runs in UTC: the week and "tomorrow" are worked out in the person's own time zone
    const urls = homeRequestUrls(workspaceId, { weekStart, taskFilters, hiddenProjects }, new Date(), timeZone);

    const code = `(function(){try{
var raw=localStorage.getItem(${JSON.stringify(CACHE_STORAGE_KEY)});
if(raw){var head=raw.slice(0,400),stamp=head.match(/"timestamp":(\\d+)/),buster=head.match(/"buster":"([^"]*)"/);
if(stamp&&buster&&buster[1]===${JSON.stringify(CACHE_BUSTER)}&&Date.now()-Number(stamp[1])<${CACHE_REFRESH_AFTER})return;}
var urls=${escapeForScript(JSON.stringify(urls))};
window.__early={urls:urls,json:fetch("/api/batch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requests:urls})}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})};
}catch(e){}})();`;

    // eslint-disable-next-line no-restricted-syntax -- an inline script has to be raw text; every value in it is JSON from ids the server holds, with < and line separators escaped (the pattern Next's JSON-LD guide uses)
    return <script nonce={requestHeaders.get("x-nonce") ?? undefined} dangerouslySetInnerHTML={{ __html: code }} />;
};
