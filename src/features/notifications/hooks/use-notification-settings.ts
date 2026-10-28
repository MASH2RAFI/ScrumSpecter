import { parseAsBoolean, useQueryState } from "nuqs";

// The notification settings popup (bell → Settings, or the Home prompt)
export const useNotificationSettings = () => {
    const [isOpen, setIsOpen] = useQueryState(
        "notification-settings",
        parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true }),
    );

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
    };
};
