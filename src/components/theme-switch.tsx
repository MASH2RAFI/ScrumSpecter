"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
    { value: "dark", label: "Dark", icon: Moon },
] as const;

// Three-position switch; the highlight slides to the chosen theme
export const ThemeSwitch = () => {
    const { theme, setTheme } = useTheme();
    // The stored theme is only known in the browser
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const index = Math.max(0, OPTIONS.findIndex((option) => option.value === (mounted ? theme : "system")));

    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            className="relative grid shrink-0 grid-cols-3 rounded-full border border-border bg-muted/60 p-0.5"
        >
            <span
                aria-hidden
                className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-300 ease-in-out motion-reduce:transition-none"
                style={{ transform: `translateX(${index * 100}%)` }}
            />
            {OPTIONS.map(({ value, label, icon: Icon }, i) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={index === i}
                    aria-label={`${label} theme`}
                    title={label}
                    onClick={() => setTheme(value)}
                    className={cn(
                        "relative z-10 flex size-7 items-center justify-center rounded-full transition-colors min-h-0 min-w-0",
                        index === i ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    <Icon className="size-4" />
                </button>
            ))}
        </div>
    );
};
