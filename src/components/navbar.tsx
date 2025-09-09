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
        <nav className="pt-4 px-6 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
                <MobileSidebar />
                <div className="flex-col flex">
                    <h1 className="text-2xl font-semibold">
                        {title}
                    </h1>
                    <p className="text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <UserButton />
            </div>
        </nav>
    );
};