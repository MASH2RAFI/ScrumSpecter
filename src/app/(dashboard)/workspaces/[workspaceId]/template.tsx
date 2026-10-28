"use client";

import { m } from "@/components/motion";

// Each page fades in as it's opened. Opacity only: a transformed ancestor would throw off
// drag-and-drop positions on the kanban board and calendar.
const WorkspacePageTemplate = ({ children }: { children: React.ReactNode }) => (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
        {children}
    </m.div>
);

export default WorkspacePageTemplate;
