import { useQueryState, useQueryStates, parseAsBoolean, parseAsInteger, parseAsIsoDateTime, parseAsString } from "nuqs";
import { TaskStatus } from "../types";

export const useCreateTaskModal = () => {
    const [isOpen, setIsOpen] = useQueryState(
        "create-task",
        parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true })
    );

    const [defaultStatus, setDefaultStatus] = useQueryState(
        "default-status",
        parseAsString.withDefault(TaskStatus.TODO).withOptions({ clearOnDefault: true })
    );

    // Set when a task is created by selecting a time range on the calendar
    const [{ start: defaultStart, duration: defaultDuration }, setDefaultTime] = useQueryStates({
        start: parseAsIsoDateTime,
        duration: parseAsInteger,
    });

    const open = (status?: TaskStatus, time?: { start: Date; durationMinutes: number }) => {
        if (status) {
            setDefaultStatus(status);
        }
        if (time) {
            setDefaultTime({ start: time.start, duration: time.durationMinutes });
        }
        setIsOpen(true);
    };
    
    const close = () => {
        setIsOpen(false);
        setDefaultStatus(TaskStatus.TODO);
        setDefaultTime({ start: null, duration: null });
    };
    
    return {
        isOpen,
        open,
        close,
        setIsOpen,
        defaultStatus: defaultStatus as TaskStatus,
        defaultStart,
        defaultDuration,
    };

};