"use client";

import { useState, type DragEvent, type HTMLAttributes, type Ref } from "react";
import { Trash2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

type DropBinProps = HTMLAttributes<HTMLDivElement> & {
    ref?: Ref<HTMLDivElement>;
    // Shown while something is being dragged
    visible: boolean;
    // Something is held over it
    over: boolean;
    label: string;
};

// The bin that appears at the bottom of the page while an item is dragged; dropping on it deletes
// (or withdraws) the item. Faded in rather than mounted, so it's in place when the drag starts.
// The menus and buttons stay as the non-drag way to do the same.
export const DropBin = ({ ref, visible, over, label, className, ...props }: DropBinProps) => (
    <div
        ref={ref}
        {...props}
        data-testid="drop-bin"
        aria-hidden={!visible}
        className={cn(
            "fixed inset-x-0 bottom-6 z-50 mx-auto flex h-20 w-[min(22rem,calc(100%-2rem))] items-center justify-center gap-2 rounded-card border-2 border-dashed text-sm font-medium shadow-lift backdrop-blur transition-[opacity,background-color,border-color,color] duration-200",
            visible ? "opacity-100" : "pointer-events-none opacity-0",
            over ? "border-destructive bg-destructive/15 text-destructive" : "border-border bg-card/95 text-muted-foreground",
            className,
        )}
    >
        <Trash2Icon className="size-5" aria-hidden />
        {label}
    </div>
);

const ITEM_TYPE = "application/x-scrumspecter-item";

// The browser's own drag and drop, for lists that don't use the Kanban's drag library:
// `source(id)` goes on each draggable item, `bin` on the <DropBin>
export const useDropBin = (onDrop: (id: string) => void) => {
    const [dragging, setDragging] = useState(false);
    const [over, setOver] = useState(false);

    const source = (id: string) => ({
        draggable: true,
        onDragStart: (event: DragEvent) => {
            event.dataTransfer.setData(ITEM_TYPE, id);
            event.dataTransfer.effectAllowed = "move";
            setDragging(true);
        },
        onDragEnd: () => {
            setDragging(false);
            setOver(false);
        },
    });

    const bin = {
        visible: dragging,
        over,
        onDragOver: (event: DragEvent) => {
            if (!event.dataTransfer.types.includes(ITEM_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (event: DragEvent) => {
            event.preventDefault();
            const id = event.dataTransfer.getData(ITEM_TYPE);
            setDragging(false);
            setOver(false);
            if (id) onDrop(id);
        },
    };

    return { source, bin };
};
