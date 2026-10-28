import { parseAsStringEnum, useQueryState } from "nuqs";

export const WORKSPACE_PANELS = ["members", "settings"] as const;
export type WorkspacePanel = (typeof WORKSPACE_PANELS)[number];

// Members and Settings open as popups over the current page (?workspace-panel=members)
export const useWorkspacePanel = () => {
    const [panel, setPanel] = useQueryState("workspace-panel", parseAsStringEnum<WorkspacePanel>([...WORKSPACE_PANELS]));

    return {
        panel,
        open: (next: WorkspacePanel) => setPanel(next),
        close: () => setPanel(null),
    };
};
