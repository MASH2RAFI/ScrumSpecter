"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    AssigneePicker,
    ProjectSelectItems,
    TaskFormFooter,
    TaskFormOptionsProps,
    TaskSelect,
} from "@/features/tasks/components/task-form-fields";

import { TaskTimeFields } from "@/features/tasks/components/task-time-fields";
import { DEFAULT_DURATION_MINUTES } from "@/features/tasks/task-time";

import { routineFieldsSchema } from "../schemas";
import { Routine, WEEKDAYS } from "../types";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { isoWeekdayOrder } from "@/lib/week";

type RoutineFields = z.infer<typeof routineFieldsSchema>;

// The form uses "" for "all day"; it becomes null (and gets a timezone) on submit
const formSchema = routineFieldsSchema.extend({
    startTime: z.string().optional(),
    durationMinutes: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RoutineFormProps extends TaskFormOptionsProps {
    initialValues?: Routine;
    isPending: boolean;
    onSubmit: (values: RoutineFields) => void;
    onCancel: () => void;
}

export const RoutineForm = ({ initialValues, isPending, onSubmit, onCancel, projectOptions, memberOptions }: RoutineFormProps) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialValues?.name ?? "",
            description: initialValues?.description ?? "",
            projectId: initialValues?.projectId ?? "",
            assigneeIds: initialValues?.assigneeIds ?? [],
            weekdays: initialValues?.weekdays ?? [1, 2, 3, 4, 5],
            storyPoints: initialValues?.storyPoints ?? 1,
            startTime: initialValues?.startTime ?? "",
            durationMinutes: initialValues?.startTime ? initialValues.durationMinutes ?? DEFAULT_DURATION_MINUTES : undefined,
        },
    });

    const { weekStart } = usePreferences();
    const orderedWeekdays = isoWeekdayOrder(weekStart).map((day) => WEEKDAYS.find((weekday) => weekday.value === day)!);

    const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Keep an existing routine's zone so its time doesn't shift when edited from elsewhere
    const timeZone = initialValues?.timeZone ?? viewerTimeZone;

    const submit = ({ startTime, durationMinutes, ...values }: FormValues) => onSubmit({
        ...values,
        startTime: startTime || null,
        durationMinutes: startTime ? durationMinutes ?? DEFAULT_DURATION_MINUTES : null,
        timeZone,
    });

    return (
        <Card className="w-full h-full border-none shadow-none">
            <CardHeader className="flex p-7">
                <CardTitle className="text-xl font-bold">
                    {initialValues ? "Edit routine" : "New weekly routine"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    A task is added on each chosen day until the project&apos;s sprint ends.
                </p>
            </CardHeader>
            <div className="px-7">
                <DottedSeparator />
            </div>
            <CardContent className="p-7">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Task name</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="e.g. Weekly team sync" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="weekdays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Repeats on</FormLabel>
                                    <div className="flex flex-wrap gap-2" role="group" aria-label="Repeats on">
                                        {orderedWeekdays.map((day) => {
                                            const selected = field.value.includes(day.value);
                                            return (
                                                <Button
                                                    key={day.value}
                                                    type="button"
                                                    size="sm"
                                                    variant={selected ? "primary" : "outline"}
                                                    aria-pressed={selected}
                                                    aria-label={day.label}
                                                    className={cn("w-12", !selected && "text-muted-foreground")}
                                                    onClick={() => field.onChange(selected
                                                        ? field.value.filter((d) => d !== day.value)
                                                        : [...field.value, day.value])}
                                                >
                                                    {day.short}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="space-y-1">
                            <TaskTimeFields />
                            {form.watch("startTime") && timeZone !== viewerTimeZone && (
                                <p className="text-xs text-muted-foreground">Time is in {timeZone}</p>
                            )}
                        </div>
                        <FormField
                            control={form.control}
                            name="projectId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project</FormLabel>
                                    <TaskSelect value={field.value} onChange={field.onChange} placeholder="Select project">
                                        <ProjectSelectItems options={projectOptions} />
                                    </TaskSelect>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="assigneeIds"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assignees</FormLabel>
                                    <AssigneePicker value={field.value} onChange={field.onChange} options={memberOptions} />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="storyPoints"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Story points</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={field.value ?? ""}
                                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={3} placeholder="Optional" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <TaskFormFooter onCancel={onCancel} isPending={isPending}>
                            <Button type="submit" size="lg" disabled={isPending}>
                                {initialValues ? "Save routine" : "Create routine"}
                            </Button>
                        </TaskFormFooter>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
