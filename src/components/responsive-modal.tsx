import { m } from "@/components/motion";
import { useMedia } from "react-use";

import { cn } from "@/lib/utils";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    Drawer,
    DrawerContent,
    DrawerTitle,
} from "@/components/ui/drawer";

interface ResponsiveModalProps {
    children: React.ReactNode;
    open: boolean
    onOpenChange: (open: boolean) => void;
    // Announced by screen readers; the visible heading lives in the children
    title: string;
    // Extra classes for the desktop dialog, e.g. a wider max-width
    className?: string;
}

export const ResponsiveModal = ({
    children,
    open,
    onOpenChange,
    title,
    className,
    }: ResponsiveModalProps) => {
    const isDesktop = useMedia("(min-width: 1024px)", true);
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent aria-describedby={undefined} className={cn("w-full sm:max-w-lg p-0 border-none overflow-y-auto hide-scrollbad max-h-[85vh]", className)}>
                    <DialogTitle className="sr-only">{title}</DialogTitle>
                    {/* The form settles into place as the dialog opens */}
                    <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
                        {children}
                    </m.div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent aria-describedby={undefined}>
                    <DrawerTitle className="sr-only">{title}</DrawerTitle>
                    <div className="overflow-y-auto hide-scrollbad max-h-[85vh]">
                        {children}
                    </div>
                </DrawerContent>
            </Drawer>
        )
};