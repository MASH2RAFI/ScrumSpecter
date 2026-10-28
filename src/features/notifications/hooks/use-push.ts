"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState =
    // Browser can't do Web Push (or the server has no keys)
    | "unsupported"
    // iPhone/iPad in a browser tab: push only works once added to the home screen
    | "ios-needs-install"
    | "blocked"
    | "off"
    | "on";

const urlBase64ToUint8Array = (base64: string) => {
    const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(padded);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const registration = () => navigator.serviceWorker.register("/sw.js");

// This device's notification state, and turning it on/off
export const usePush = () => {
    const queryClient = useQueryClient();
    const [state, setState] = useState<PushState | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
            setState(isIos() && !isStandalone() ? "ios-needs-install" : "unsupported");
            return;
        }
        if (!VAPID_PUBLIC_KEY) {
            setState("unsupported");
            return;
        }
        if (Notification.permission === "denied") {
            setState("blocked");
            return;
        }
        const subscription = await (await registration()).pushManager.getSubscription();
        setState(subscription && Notification.permission === "granted" ? "on" : "off");
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const enable = async () => {
        setBusy(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setState(permission === "denied" ? "blocked" : "off");
                return false;
            }
            const reg = await registration();
            await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.getSubscription()
                ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
            const { endpoint, keys } = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            const response = await client.api.notifications.subscriptions.$post({ json: { endpoint, keys } });
            if (!response.ok) throw new Error("Couldn't save this device");
            setState("on");
            return true;
        } finally {
            setBusy(false);
            queryClient.invalidateQueries({ queryKey: ["push-devices"] });
        }
    };

    const disable = async () => {
        setBusy(true);
        try {
            const subscription = await (await registration()).pushManager.getSubscription();
            if (subscription) {
                await client.api.notifications.subscriptions.$delete({ json: { endpoint: subscription.endpoint } });
                await subscription.unsubscribe();
            }
            setState("off");
        } finally {
            setBusy(false);
            queryClient.invalidateQueries({ queryKey: ["push-devices"] });
        }
    };

    return { state, busy, enable, disable };
};
