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

const THEME_OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
] as const;

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

    // Not authenticated
    if (!user) {
        return null;
    }

    const { name, email } = user;
    const avatarFallback = (name || email).charAt(0).toUpperCase();

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="outline-none relative" aria-label="Account menu">
                <Avatar className="size-10 hover:opacity-75 transition border border-border min-w-[40px] min-h-[40px] shadow-sm">
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary flex items-center justify-center">
                        {avatarFallback}
                    </AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="w-64 bg-popover border border-border shadow-lg" sideOffset={10}>
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
                            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                                <DropdownMenuItem
                                    key={value}
                                    onClick={() => setTheme(value)}
                                    className={`h-9 flex items-center justify-start text-sm cursor-pointer rounded-md px-3 transition-colors ${
                                        theme === value
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "hover:bg-accent text-foreground"
                                    }`}
                                >
                                    <Icon className="size-4 mr-3" />
                                    {label}
                                </DropdownMenuItem>
                            ))}
                        </div>
                    </div>

                    <DottedSeparator className="mb-1" />
                    <DropdownMenuItem
                        onClick={logout}
                        className="h-10 flex items-center justify-center text-destructive font-medium cursor-pointer hover:bg-destructive/10 rounded-md transition-colors"
                    >
                        <LogOut className="size-4 mr-2" />
                        Log out
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};