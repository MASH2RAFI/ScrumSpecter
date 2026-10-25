import { RefObject, useEffect } from "react";

// Calls onClose on a mousedown outside `ref` or on Escape while open.
export const useDismiss = (ref: RefObject<HTMLElement>, isOpen: boolean, onClose: () => void) => {
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [ref, isOpen, onClose]);
};
