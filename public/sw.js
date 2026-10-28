// ScrumSpecter service worker: shows task reminders sent with Web Push, even when no
// ScrumSpecter tab is open, and opens the task when one is clicked.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    let message = {};
    try {
        message = event.data ? event.data.json() : {};
    } catch {
        message = { title: "ScrumSpecter", body: event.data ? event.data.text() : "" };
    }

    event.waitUntil(
        self.registration.showNotification(message.title || "ScrumSpecter", {
            body: message.body || "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            // Same tag replaces an older copy of the same reminder instead of stacking
            tag: message.tag,
            data: { url: message.url || "/" },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
        if (open) {
            await open.focus();
            return open.navigate(url);
        }
        return self.clients.openWindow(url);
    })());
});
