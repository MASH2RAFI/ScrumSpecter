"use client";

import { useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon, TrashIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useAddHoliday, useGetHolidayCountries, useGetHolidays, useRemoveHoliday, useSetHolidayCountry } from "../api/use-holidays";

const NONE = "none";

const formatDay = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

// Public holidays for the workspace's country plus its own days off. Routine tasks skip them all.
export const HolidaySettings = ({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const { data, isLoading } = useGetHolidays({ workspaceId, from: `${year}-01-01`, to: `${year}-12-31`, includeHidden: true });
    const { data: countries } = useGetHolidayCountries();
    const setCountry = useSetHolidayCountry();
    const addHoliday = useAddHoliday();
    const removeHoliday = useRemoveHoliday();
    const [date, setDate] = useState("");
    const [name, setName] = useState("");
    const busy = setCountry.isPending || addHoliday.isPending || removeHoliday.isPending;

    const addDayOff = (event: FormEvent) => {
        event.preventDefault();
        addHoliday.mutate({ workspaceId, date, name, kind: "custom" }, {
            onSuccess: () => { setDate(""); setName(""); },
        });
    };

    return (
        <Card className="w-full border-none shadow-none">
            <CardContent className="p-0 space-y-5">
                <div>
                    <h3 className="font-bold">Holidays</h3>
                    <p className="text-sm text-muted-foreground">
                        Shown on the calendar. Routine tasks aren&apos;t created on these days.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor="holiday-country">Public holidays</Label>
                    <Select
                        value={data?.country ?? NONE}
                        disabled={!isAdmin || busy}
                        onValueChange={(value) => setCountry.mutate({ workspaceId, holidayCountry: value === NONE ? "" : value })}
                    >
                        <SelectTrigger id="holiday-country" className="w-64">
                            <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>None</SelectItem>
                            {countries?.map((country) => (
                                <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="sm" aria-label="Previous year" onClick={() => setYear(year - 1)}>‹</Button>
                        <span className="text-sm font-medium w-12 text-center">{year}</span>
                        <Button variant="ghost" size="sm" aria-label="Next year" onClick={() => setYear(year + 1)}>›</Button>
                    </div>
                </div>

                <ul className="divide-y rounded-md border" aria-label={`Holidays in ${year}`}>
                    {isLoading && <li className="p-3 text-sm text-muted-foreground">Loading…</li>}
                    {data?.holidays.length === 0 && <li className="p-3 text-sm text-muted-foreground">No holidays in {year}.</li>}
                    {data?.holidays.map((holiday) => (
                        <li key={`${holiday.source}-${holiday.date}`} className={cn("flex items-center gap-3 px-3 py-2 text-sm", holiday.hidden && "opacity-50")}>
                            <span className="w-28 shrink-0 text-muted-foreground">{formatDay(holiday.date)}</span>
                            <span className={cn("flex-1 truncate", holiday.hidden && "line-through")}>{holiday.name}</span>
                            {holiday.source === "custom" ? <Badge variant="secondary">Day off</Badge> : holiday.hidden && <Badge variant="outline">Hidden</Badge>}
                            {isAdmin && (holiday.source === "custom" ? (
                                <Button variant="ghost" size="icon" className="size-8" disabled={busy} aria-label={`Remove ${holiday.name}`}
                                    onClick={() => removeHoliday.mutate({ workspaceId, date: holiday.date, kind: "custom" })}>
                                    <TrashIcon className="size-4" />
                                </Button>
                            ) : (
                                <Button variant="ghost" size="icon" className="size-8" disabled={busy}
                                    aria-label={`${holiday.hidden ? "Show" : "Hide"} ${holiday.name}`}
                                    title={holiday.hidden ? "Treat as a holiday again" : "Not a holiday for us (work as usual)"}
                                    onClick={() => holiday.hidden
                                        ? removeHoliday.mutate({ workspaceId, date: holiday.date, kind: "hidden" })
                                        : addHoliday.mutate({ workspaceId, date: holiday.date, name: holiday.name, kind: "hidden" })}>
                                    {holiday.hidden ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
                                </Button>
                            ))}
                        </li>
                    ))}
                </ul>

                {isAdmin && (
                    <form onSubmit={addDayOff} className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                            <Label htmlFor="day-off-date">Date</Label>
                            <Input id="day-off-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-44" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-[160px]">
                            <Label htmlFor="day-off-name">Name</Label>
                            <Input id="day-off-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office closed" required maxLength={80} />
                        </div>
                        <Button type="submit" disabled={busy}>Add day off</Button>
                    </form>
                )}
            </CardContent>
        </Card>
    );
};
