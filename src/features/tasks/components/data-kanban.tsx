import { Stagger, StaggerItem } from "@/components/motion";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { 
DragDropContext, 
Droppable, 
Draggable, 
DropResult,
} from "@hello-pangea/dnd";
import { toast } from "sonner";

import { usePermissions } from "@/features/members/hooks/use-permissions";
import { canSetStatus } from "@/features/members/permissions";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { DropBin } from "@/components/drop-bin";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { cn } from "@/lib/utils";

import { useDeleteTask } from "../api/use-delete-task";
import { Task, TaskStatus } from "../types"; 
import { KanbanColumnHeader, KanbanQuickAdd } from "./kanban-column-header";
import { KanbanCard } from "./kanban-card";

const boards: TaskStatus[] = [
    TaskStatus.BACKLOG,
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.IN_REVIEW,
    TaskStatus.DONE,
];

type TasksState = { 
[key in TaskStatus]: Task[];
}; 

interface DataKanbanProps { 
    data: Task[]; 
    onChange: (tasks: { $id: string; status: TaskStatus; position: number }[]) => void;
};

// Each status column, in board order
const groupByStatus = (data: Task[]): TasksState => {
    const groups: TasksState = {
        [TaskStatus.BACKLOG]: [],
        [TaskStatus.TODO]: [],
        [TaskStatus.IN_PROGRESS]: [],
        [TaskStatus.IN_REVIEW]: [],
        [TaskStatus.DONE]: [],
    };
    data.forEach((task) => groups[task.status].push(task));
    Object.values(groups).forEach((column) => column.sort((a, b) => a.position - b.position));
    return groups;
};

export const Datakanban = ({
    data,
    onChange,
}: DataKanbanProps) => { 
    const [tasks, setTasks] = useState(() => groupByStatus(data));
    // New data from the server replaces the local copy that drags rearrange
    const [shownData, setShownData] = useState(data);
    if (data !== shownData) {
        setShownData(data);
        setTasks(groupByStatus(data));
    }

    const workspaceId = useWorkspaceId();
    const { role, memberId, isViewer, canEditWork } = usePermissions({ workspaceId });
    const { mutate: deleteTask } = useDeleteTask();
    const { kanbanCompact, kanbanShrinkEmpty } = usePreferences();
    const [dragging, setDragging] = useState(false);
    // The bin is found by the pointer's position, not as one of the library's drop areas: in
    // production builds it never reported a card as over the fixed-position bin
    const binRef = useRef<HTMLDivElement>(null);
    const overBinRef = useRef(false);
    const [overBin, setOverBin] = useState(false);
    useEffect(() => {
        if (!dragging) return;
        const onMove = (event: PointerEvent) => {
            const box = binRef.current?.getBoundingClientRect();
            const over = Boolean(box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom);
            overBinRef.current = over;
            setOverBin(over);
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
    }, [dragging]);

    const onDragEnd = useCallback( (result: DropResult) => {
        const intoBin = overBinRef.current;
        overBinRef.current = false;
        setOverBin(false);
        setDragging(false);
        const { source, destination } = result;
        const sourceStatus = source.droppableId as TaskStatus;

        // Into the bin: deleted, with the usual Undo toast
        if (intoBin && canEditWork) {
            const task = tasks[sourceStatus][source.index];
            if (!task) return;
            setTasks((prevTasks) => ({ ...prevTasks, [sourceStatus]: prevTasks[sourceStatus].filter((t) => t.$id !== task.$id) }));
            deleteTask({ param: { taskId: task.$id } });
            return;
        }
        if (!destination) return;
        const destStatus = destination.droppableId as TaskStatus;

        // Refuse moves the role doesn't allow before anything changes on screen
        if (sourceStatus !== destStatus) {
            const task = tasks[sourceStatus][source.index];
            const isAssignee = Boolean(memberId && task?.assigneeIds?.includes(memberId));
            if (!canSetStatus(role, { isAssignee, from: sourceStatus, to: destStatus })) {
                toast.error(isAssignee
                    ? "A reviewer approves work to Done. Move it to In Review."
                    : "You can only change the status of tasks assigned to you");
                return;
            }
        }
        // Worked out here, not in a setTasks updater: React may run that later, after onChange has sent the moves
        const newTasks = { ...tasks };

        const sourceColumn = [...newTasks[sourceStatus]]; 
        const [movedTask] = sourceColumn.splice(source.index, 1);

        if (!movedTask) {
            console.error("No task found at the source index"); 
            return;
        } 

        const updatedMovedTask = sourceStatus !== destStatus 
            ? { ...movedTask, status: destStatus } 
            : movedTask; 

        newTasks[sourceStatus] = sourceColumn;
        const destColumn = [...newTasks[destStatus]];
        destColumn.splice(destination.index, 0, updatedMovedTask);
        newTasks[destStatus] = destColumn;

        const updatesPayload: { $id: string; status: TaskStatus; position: number }[] = [];
        updatesPayload.push({
            $id: updatedMovedTask.$id,
            status: destStatus,
            position: Math.min((destination.index + 1) * 1000, 1_000_000)
        })
        newTasks[destStatus].forEach( (task, index) => { 
            if (task && task.$id !== updatedMovedTask.$id) {
                const newPosition = Math.min( (index + 1) * 1000, 1_000_000); 
                if (task.position !== newPosition) {
                    updatesPayload.push({
                        $id: task.$id,
                        status: destStatus,
                        position: newPosition,
                    });
                }
            }
        });

        if (sourceStatus !== destStatus) {
            newTasks[sourceStatus].forEach( (task, index) => {
                if (task) {
                    const newPosition = Math.min((index + 1) * 1000, 1_000_000);
                    if (task.position !== newPosition) {
                        updatesPayload.push({
                            $id: task.$id,
                            status: sourceStatus,
                            position: newPosition,
                        });
                    }
                }
            });
        }
        setTasks(newTasks);

        onChange(updatesPayload);
    }, [onChange, tasks, role, memberId, deleteTask, canEditWork]);


    return ( 
        <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={onDragEnd}>
            {/* Phones: one column under another; wider screens: side by side */}
            {/* Columns rise in one after another when the board opens */}
            <Stagger className="flex flex-col gap-3 pb-2 md:flex-row md:gap-0 md:overflow-x-auto">
                {boards.map( (board) => {
                    return (
                        <StaggerItem key={board} className={cn(
                            "bg-muted/50 p-2 rounded-card border border-border/60 md:flex-1 md:mx-1.5 md:min-w-[200px] transition-[flex-grow,min-width] duration-300",
                            // Narrowed rather than hidden, so a card can still be dropped into it
                            kanbanShrinkEmpty && tasks[board].length === 0 && "md:flex-none md:w-48 md:min-w-0",
                        )}>
                            <KanbanColumnHeader
                                board={board}
                                taskCount={tasks[board].length}
                                storyPoints={tasks[board].reduce((sum, task) => sum + (task.storyPoints ?? 0), 0)}
                            />

                            <Droppable droppableId={board}>
                                {(provided) =>(
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="min-h-[72px] py-1.5 md:min-h-[200px]"
                                    >

                                        {tasks[board].map( (task, index) => (
                                            <Draggable
                                                key={task.$id}
                                                draggableId={task.$id}
                                                index={index}
                                                isDragDisabled={isViewer}
                                            >
                                            
                                                {(provided) => (
                                                    <div 
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                    >
                                                        <KanbanCard task={task} compact={kanbanCompact} />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}

                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                            <KanbanQuickAdd board={board} />

                        </StaggerItem>
                    )
                })}
            </Stagger>
            {/* Only for the people who may delete tasks */}
            {canEditWork && (
                <DropBin ref={binRef} visible={dragging} over={overBin} label="Drop to delete" />
            )}
        </DragDropContext>
    )
}