import { parseAsString, useQueryState } from "nuqs";

export const useEditProjectModal = () => {
    const [projectId, setProjectId] = useQueryState("edit-project", parseAsString);

    const open = (id: string) => setProjectId(id);
    const close = () => setProjectId(null);

    return {
        projectId,
        open,
        close,
    };
};
