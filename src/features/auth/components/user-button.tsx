"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Loader, LogOut, Sun, Moon, Monitor } from "lucide-react";

import { DottedSeparator } from "@/components/dotted-separator";
import { useTheme } from "next-themes";

import { useLogout } from "../api/use-logout";
import { useCurrent } from "../api/use-current";

export const UserButton = () => { 
    const { data: user, isLoading, error } = useCurrent();
    const { mutate: logout } = useLogout();
    const { setTheme, theme } = useTheme();

    // Show loading state while fetching or if there's an error and we're retrying
    if (isLoading || (error && !user)) {
        return (
            <div className="size-10 rounded-full flex items-center justify-center bg-muted border border-border min-w-[40px] min-h-[40px] shadow-sm">
                <Loader className="size-4 animate-spin text-primary" />
            </div>
        );
    }

    // Only hide if we have no user and no error (meaning we're not authenticated)
    if (!user && !error) {
        return null;
    }

    // At this point, user should not be null due to the loading check above
    const { name, email } = user!;

    const avatarFallback = name
        ? name.charAt(0).toUpperCase()
        : email?.charAt(0)?.toUpperCase() ?? "U";
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="outline-none relative">
                <Avatar className="size-10 hover:opacity-75 transition border border-border min-w-[40px] min-h-[40px] shadow-sm"> 
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary flex items-center justify-center"> 
                        {avatarFallback}
                    </AvatarFallback> 
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align = "end" side= "bottom" className = "w-64 bg-popover border border-border shadow-lg" sideOffset={10}>
                <div className="flex flex-col items-center justify-center gap-3 p-4">
                    <Avatar className="size-[52px] border border-border shadow-md"> 
                        <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary flex items-center justify-center"> 
                            {avatarFallback}
                        </AvatarFallback> 
                    </Avatar>

                    <div className="flex flex-col items-center justify-center text-center">
                        <p className="text-sm font-semibold text-foreground">
                            {name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
                    </div>

                    <DottedSeparator className="mb-1" />
                    
                    {/* Theme Selection */}
                    <div className="w-full">
                        <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Theme</p>
                        <div className="flex flex-col gap-0.5">
                            <DropdownMenuItem
                                onClick={() => setTheme("light")}
                                className={`h-9 flex items-center justify-start text-sm cursor-pointer rounded-md px-3 transition-colors ${
                                    theme === "light" 
                                        ? "bg-primary text-primary-foreground shadow-sm" 
                                        : "hover:bg-accent text-foreground"
                                }`}
                            >
                                <Sun className="size-4 mr-3" />
                                Light
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setTheme("dark")}
                                className={`h-9 flex items-center justify-start text-sm cursor-pointer rounded-md px-3 transition-colors ${
                                    theme === "dark" 
                                        ? "bg-primary text-primary-foreground shadow-sm" 
                                        : "hover:bg-accent text-foreground"
                                }`}
                            >
                                <Moon className="size-4 mr-3" />
                                Dark
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setTheme("system")}
                                className={`h-9 flex items-center justify-start text-sm cursor-pointer rounded-md px-3 transition-colors ${
                                    theme === "system" 
                                        ? "bg-primary text-primary-foreground shadow-sm" 
                                        : "hover:bg-accent text-foreground"
                                }`}
                            >
                                <Monitor className="size-4 mr-3" />
                                System
                            </DropdownMenuItem>
                        </div>
                    </div>
                    
                    <DottedSeparator className="mb-1" />
                    <DropdownMenuItem
                        onClick = {logout}
                        className="h-10 flex items-center justify-center text-destructive font-medium cursor-pointer hover:bg-destructive/10 rounded-md transition-colors">
                        <LogOut className="size-4 mr-2" />
                            Log out
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>

    );
};