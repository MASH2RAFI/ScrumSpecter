import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";

// Create and edit share one modal; the edited routine's id lives in the URL like other modals
export const useRoutineModal = () => {
    const [isCreating, setIsCreating] = useQueryState(
        "create-routine",
        parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true })
    );
    const [routineId, setRoutineId] = useQueryState("edit-routine", parseAsString);

    return {
        isOpen: isCreating || Boolean(routineId),
        routineId,
        openCreate: () => setIsCreating(true),
        openEdit: (id: string) => setRoutineId(id),
        close: () => {
            setIsCreating(false);
            setRoutineId(null);
        },
    };
};
