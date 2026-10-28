import { Stagger, StaggerItem } from "@/components/motion";
import React, { useCallback, useEffect, useState } from "react"; 

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

export const Datakanban = ({
    data,
    onChange,
}: DataKanbanProps) => { 
    const [tasks, setTasks] = useState<TasksState>(() => {

        const initialTasks: TasksState = {
            [TaskStatus.BACKLOG] : [],
            [TaskStatus.TODO]: [],
            [TaskStatus.IN_PROGRESS]: [],
            [TaskStatus.IN_REVIEW]: [],
            [TaskStatus.DONE]: [],
        };

        data.forEach( (task) => {
            initialTasks[task.status].push(task);
        });
        
        Object.keys(initialTasks).forEach( (status) => {
            initialTasks[status as TaskStatus].sort((a, b) => a.position - b.position);
        });

        return initialTasks;

    });

    useEffect(() => {
        const newTasks: TasksState = {
            [TaskStatus.BACKLOG] : [],
            [TaskStatus.TODO]: [],
            [TaskStatus.IN_PROGRESS]: [],
            [TaskStatus.IN_REVIEW]: [],
            [TaskStatus.DONE]: [],
        };

        data.forEach( (task) => {
            newTasks[task.status].push(task);
        });

        Object.keys(newTasks).forEach( (status) => {
            newTasks[status as TaskStatus].sort((a, b) => a.position - b.position);
        });

        setTasks(newTasks);

    }, [data]);

    const workspaceId = useWorkspaceId();
    const { role, memberId, isViewer } = usePermissions({ workspaceId });

    const onDragEnd = useCallback( (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination } = result;
        const sourceStatus = source.droppableId as TaskStatus;
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
        let updatesPayload: { $id: string; status: TaskStatus; position: number; }[]=[];


        setTasks((prevTasks) => {
            const newTasks = { ...prevTasks }; 

            const sourceColumn = [...newTasks[sourceStatus]]; 
            const [movedTask] = sourceColumn.splice(source.index, 1);

            if (!movedTask) {
                console.error("No task found at the source index"); 
                return prevTasks;
            } 

            const updatedMovedTask = sourceStatus !== destStatus 
                ? { ...movedTask, status: destStatus } 
                : movedTask; 

            newTasks[sourceStatus] = sourceColumn;
            const destColumn = [...newTasks[destStatus]];
            destColumn.splice(destination.index, 0, updatedMovedTask);
            newTasks[destStatus] = destColumn;

            updatesPayload = [];
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
            return newTasks;
        });

        onChange(updatesPayload);
    }, [onChange, tasks, role, memberId]);


    return ( 
        <DragDropContext onDragEnd={onDragEnd}>
            {/* Phones: one column under another; wider screens: side by side */}
            {/* Columns rise in one after another when the board opens */}
            <Stagger className="flex flex-col gap-3 pb-2 md:flex-row md:gap-0 md:overflow-x-auto">
                {boards.map( (board) => {
                    return (
                        <StaggerItem key={board} className="bg-muted/50 p-2 rounded-card border border-border/60 md:flex-1 md:mx-1.5 md:min-w-[200px]">
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
                                                        <KanbanCard task={task} />
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
        </DragDropContext>
    )
}