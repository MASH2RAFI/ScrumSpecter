"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Press ? (or pick "Keyboard shortcuts" in the quick-jump menu)
export const ShortcutsDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
    const shortcuts = [
        { keys: [isMac() ? "⌘" : "Ctrl", "K"], label: "Quick jump to a page, project or task" },
        { keys: ["C"], label: "New task (admins and supervisors; others send a request)" },
        { keys: ["/"], label: "Search tasks" },
        { keys: ["["], label: "Keep the sidebar open / auto-hide it" },
        { keys: ["?"], label: "Show these shortcuts" },
        { keys: ["Esc"], label: "Close a popup or panel" },
        { keys: ["Shift", "Click"], label: "Select a range of rows in the table" },
        { keys: [isMac() ? "⌘" : "Ctrl", "Click"], label: "Add or remove one row in the table" },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-md">
                <DialogTitle>Keyboard shortcuts</DialogTitle>
                <ul className="divide-y" aria-label="Keyboard shortcuts">
                    {shortcuts.map(({ keys, label }) => (
                        <li key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
                            <span>{label}</span>
                            <span className="flex shrink-0 gap-1">
                                {keys.map((key) => (
                                    <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-muted-foreground">Shortcuts don&apos;t fire while you&apos;re typing in a field.</p>
            </DialogContent>
        </Dialog>
    );
};
