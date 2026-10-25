"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Sidebar } from "./sidebar";

export const MobileSidebar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    return (
        <Sheet modal={false} open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden p-2 h-9 w-9 hover:bg-muted/50 transition-colors"
                >
                    <MenuIcon className="size-5 text-foreground" />
                    <span className="sr-only">Open menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent
                side="left"
                className="p-0 w-80 sm:w-96 border-r border-border/50"
            >
                <div className="h-full overflow-y-auto">
                    <Sidebar />
                </div>
            </SheetContent>
        </Sheet>
    );
};