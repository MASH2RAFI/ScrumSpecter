"use client";

import { usePathname } from "next/navigation";

import { SIDEBAR_FADE } from "@/components/sidebar-context";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Grey outlines of a page while its data loads, shaped like what's coming so nothing jumps
// when it arrives. Screen readers hear "Loading…" once.

export const Loading = ({ className, children, label = "Loading…" }: { className?: string; children: React.ReactNode; label?: string }) => (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
        <span className="sr-only">{label}</span>
        {children}
    </div>
);

const Lines = ({ count, className }: { count: number; className?: string }) => (
    <>
        {Array.from({ length: count }, (_, i) => (
            // Uneven widths read as text rather than bars
            <Skeleton key={i} className={cn("h-3", ["w-full", "w-11/12", "w-4/5", "w-2/3"][i % 4], className)} />
        ))}
    </>
);

const PageHeading = () => (
    <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-28" />
        </div>
    </div>
);

const CardBlock = ({ className, lines = 3 }: { className?: string; lines?: number }) => (
    <div className={cn("space-y-3 rounded-card border border-border/60 bg-card p-5", className)}>
        <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-32" />
        </div>
        <Lines count={lines} />
    </div>
);

// Search, filters, then a table: the tasks area of My Tasks and of a project
export const TaskViewSkeleton = ({ rows = 6 }: { rows?: number }) => (
    <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
                {[16, 20, 20].map((w, i) => <Skeleton key={i} className="h-9" style={{ width: `${w * 4}px` }} />)}
            </div>
            <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-full sm:w-56" />
            {[0, 1, 2].map((i) => <Skeleton key={i} className="hidden h-9 w-32 sm:block" />)}
        </div>
        <TableSkeleton rows={rows} />
    </div>
);

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
    <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex gap-4 border-b bg-muted/30 px-4 py-3">
            {["w-1/3", "w-1/6", "w-1/6", "w-1/6"].map((w, i) => <Skeleton key={i} className={cn("h-3", w)} />)}
        </div>
        {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                <Skeleton className="h-4 w-1/3" />
                <div className="flex w-1/6 items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="hidden h-3 flex-1 sm:block" />
                </div>
                <Skeleton className="h-3 w-1/6" />
                <Skeleton className="h-5 w-1/6 rounded-full" />
            </div>
        ))}
    </div>
);

// Home: My work, then the project cards
export const HomeSkeleton = () => (
    <div className="space-y-8">
        <div className="space-y-4 rounded-card border border-border/60 bg-card p-5">
            <Skeleton className="h-6 w-32" />
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="hidden h-3 w-24 sm:block" />
                </div>
            ))}
        </div>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => <CardBlock key={i} lines={4} />)}
            </div>
        </div>
    </div>
);

export const ProjectSkeleton = () => (
    <div className="flex flex-col gap-y-6">
        <div className="flex items-center justify-between">
            <PageHeading />
            <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <CardBlock key={i} />)}
        </div>
        <TaskViewSkeleton rows={4} />
    </div>
);

export const TaskDetailSkeleton = () => (
    <div className="flex flex-col gap-y-4">
        <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CardBlock lines={5} />
            <CardBlock lines={4} />
        </div>
    </div>
);

// Routines: the list above the weekday overview
export const RoutinesSkeleton = () => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-32" />
        </div>
        {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 p-4">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                </div>
            </div>
        ))}
        <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="mx-auto h-3 w-8" />
                    <Skeleton className="h-40 sm:h-64" />
                </div>
            ))}
        </div>
    </div>
);

// Cards in a column (change requests and similar lists)
export const CardListSkeleton = ({ count = 3 }: { count?: number }) => (
    <div className="space-y-4">
        {Array.from({ length: count }, (_, i) => (
            <div key={i} className="space-y-3 rounded-card border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Lines count={2} />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>
        ))}
    </div>
);

const AnalyticsSkeleton = () => (
    <div className="space-y-6">
        <PageHeading />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
        </div>
    </div>
);

// Labels and inputs, then the buttons: the inside of a form popup
export const FormSkeleton = ({ fields = 4, className }: { fields?: number; className?: string }) => (
    <Loading className={cn("space-y-6 p-7", className)}>
        <Skeleton className="h-6 w-40" />
        <div className="space-y-5">
            {Array.from({ length: fields }, (_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))}
        </div>
        <div className="flex justify-between">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
        </div>
    </Loading>
);

// A few avatar-and-name rows, as in the sidebar's lists (the names fade while it's folded)
export const RowsSkeleton = ({ rows = 3, className }: { rows?: number; className?: string }) => (
    <Loading className={cn("space-y-1", className)}>
        {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5">
                <Skeleton className="size-5 shrink-0 rounded-md" />
                <Skeleton className={cn("h-3 flex-1", SIDEBAR_FADE)} />
            </div>
        ))}
    </Loading>
);

// The content skeleton for whichever dashboard page is opening
const contentFor = (pathname: string) => {
    const [, , , section, id] = pathname.split("/");
    if (section === "tasks") return id ? <TaskDetailSkeleton /> : <TaskViewSkeleton />;
    if (section === "projects" && id) return <ProjectSkeleton />;
    if (section === "routines") return <RoutinesSkeleton />;
    if (section === "requests") return <CardListSkeleton />;
    if (section === "analytics") return <AnalyticsSkeleton />;
    return <HomeSkeleton />;
};

export const PageSkeleton = () => <Loading>{contentFor(usePathname() ?? "")}</Loading>;

// The whole dashboard (folded sidebar, top bar and page) before the app has started
export const DashboardSkeleton = () => {
    const pathname = usePathname() ?? "";
    return (
        <Loading className="flex min-h-screen w-full">
            <div className="fixed left-0 top-0 hidden h-full w-[76px] flex-col items-center gap-3 border-r border-border/50 bg-background py-5 lg:flex">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="mt-3 h-10 w-11" />
                <div className="mt-3 flex flex-col gap-4">
                    {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="size-6 rounded-md" />)}
                </div>
                <div className="mt-4 flex flex-col gap-3">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="size-6 rounded-md" />)}
                </div>
            </div>
            <div className="w-full lg:pl-[76px]">
                <div className="mx-auto max-w-screen-2xl">
                    <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-3">
                            <Skeleton className="size-9 lg:hidden" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="hidden h-3 w-56 sm:block" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="size-9 rounded-full" />
                            <Skeleton className="size-9 rounded-full" />
                            <Skeleton className="size-10 rounded-full" />
                        </div>
                    </div>
                    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:py-8">{contentFor(pathname)}</div>
                </div>
            </div>
        </Loading>
    );
};

// A single centred card (account page, invite links)
export const CardPageSkeleton = () => (
    <Loading className="mx-auto w-full max-w-xl space-y-6 rounded-card border border-border/60 bg-card p-7">
        <Skeleton className="h-7 w-48" />
        <Lines count={3} />
        <div className="space-y-4">
            {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))}
        </div>
        <Skeleton className="h-10 w-full" />
    </Loading>
);
