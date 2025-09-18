"use client"

import { UserButton } from "@/features/auth/components/user-button";
import { MobileSidebar } from "./mobile-sidebar";
import { usePathname } from "next/navigation";

const pathnameMap =  {
    "tasks": { 
        title: "My Tasks", 
        description: "View all of your tasks here",
    },
    "projects": { 
        title: "My Project", 
        description: "View tasks of your project here" 
    },
    "analytics": {
        title: "Analytics Dashboard",
        description: "View analytics and reports here"
    },
};

const defaultMap = { 
    title: "Home",
    description: "Monitor all of your projects and tasks here",
}

export const Navbar = () => {
    const pathname = usePathname(); 
    const pathnameParts = pathname.split("/");
    const pathnameKey = pathnameParts[3] as keyof typeof pathnameMap;
    const { title, description } = pathnameMap[pathnameKey] || defaultMap;
    
    return (
        <nav className="sticky top-0 z-40 pt-3 pb-3 px-4 sm:px-6 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-unified border-b border-border/50">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <MobileSidebar />
                <div className="flex-col flex min-w-0 flex-1">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-semibold truncate">
                        {title}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                        {description}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <UserButton />
            </div>
        </nav>
    );
};