import { parseAsString, useQueryState } from "nuqs";

// The task shown in the side panel lives in the URL, so it survives refresh and can be shared
export const useTaskPanel = () => {
    const [taskId, setTaskId] = useQueryState("task", parseAsString);

    return {
        taskId,
        open: (id: string) => setTaskId(id),
        close: () => setTaskId(null),
    };
};
