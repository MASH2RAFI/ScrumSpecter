import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";
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

    const open = (status?: TaskStatus) => {
        if (status) {
            setDefaultStatus(status);
        }
        setIsOpen(true);
    };
    
    const close = () => {
        setIsOpen(false);
        setDefaultStatus(TaskStatus.TODO);
    };
    
    return {
        isOpen,
        open,
        close,
        setIsOpen,
        defaultStatus: defaultStatus as TaskStatus,
    };

};