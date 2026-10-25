import { useMedia } from "react-use";

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
}

export const ResponsiveModal = ({
    children,
    open,
    onOpenChange,
    title,
    }: ResponsiveModalProps) => {
    const isDesktop = useMedia("(min-width: 1024px)", true);
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent aria-describedby={undefined} className="w-full sm:max-w-lg p-0 border-none overflow-y-auto hide-scrollbad max-h-[85vh]">
                    <DialogTitle className="sr-only">{title}</DialogTitle>
                    {children}
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