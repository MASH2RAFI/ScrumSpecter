"use client";

import { ResponsiveModal } from "@/components/responsive-modal";
import { usePreferences } from "@/features/auth/hooks/use-preferences";

import { useNotificationSettings } from "../hooks/use-notification-settings";
import { NotificationSettings } from "./notification-settings";

export const NotificationSettingsModal = () => {
    const { isOpen, close } = useNotificationSettings();
    const preferences = usePreferences();

    return (
        <ResponsiveModal title="Notification settings" open={isOpen} onOpenChange={(open) => !open && close()}>
            {isOpen && (
                <div className="p-6 space-y-2">
                    <h2 className="text-xl font-bold">Notification settings</h2>
                    <NotificationSettings preferences={preferences} />
                </div>
            )}
        </ResponsiveModal>
    );
};
