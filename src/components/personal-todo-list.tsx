"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Plus,
    X,
    Edit2,
    Trash2,
    Play,
    Pause,
    Square,
    Clock,
    CheckCircle2,
    ListTodo,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// Stored as JSON under this key; keep the key and shape stable so existing todos survive
const STORAGE_KEY = "personal-todos";

interface PersonalTodo {
    id: string;
    text: string;
    completed: boolean;
    timer: {
        isRunning: boolean;
        timeSpent: number; // seconds
        startTime?: number;
    };
    createdAt: Date;
}

const loadTodos = (): PersonalTodo[] => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
        return JSON.parse(saved).map((todo: PersonalTodo & { createdAt: string }) => ({
            ...todo,
            createdAt: new Date(todo.createdAt),
        }));
    } catch (error) {
        console.error("Error loading todos:", error);
        return [];
    }
};

const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toString().padStart(2, "0");

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${secs}`;
    }
    return `${minutes}:${secs}`;
};

const ICON_BUTTON_CLASS_NAME = "h-7 w-7 p-0 focus:ring-1 focus:ring-offset-1";
const TIMER_BUTTON_CLASS_NAME = cn(ICON_BUTTON_CLASS_NAME, "disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0");
const EDIT_BUTTON_CLASS_NAME = "h-8 w-8 p-0 focus:ring-1 focus:ring-offset-1";

export const PersonalTodoWidget = React.memo(function PersonalTodoWidget() {
    const [todos, setTodos] = useState<PersonalTodo[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [newTodoText, setNewTodoText] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    // Nothing renders (or is saved) until mounted, to avoid hydration mismatches
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setTodos(loadTodos());
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }, [todos, isClient]);

    // Each second, move elapsed time of running timers into timeSpent
    useEffect(() => {
        const interval = setInterval(() => {
            setTodos((prev) => prev.map((todo) => {
                if (!todo.timer.isRunning || !todo.timer.startTime) return todo;
                const now = Date.now();
                const elapsed = Math.floor((now - todo.timer.startTime) / 1000);
                return {
                    ...todo,
                    timer: { ...todo.timer, timeSpent: todo.timer.timeSpent + elapsed, startTime: now },
                };
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const updateTodo = useCallback((id: string, update: (todo: PersonalTodo) => PersonalTodo) => {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? update(todo) : todo)));
    }, []);

    const addTodo = () => {
        const text = newTodoText.trim();
        if (!text) return;
        setTodos((prev) => [{
            id: Date.now().toString(),
            text,
            completed: false,
            timer: { isRunning: false, timeSpent: 0 },
            createdAt: new Date(),
        }, ...prev]);
        setNewTodoText("");
    };

    const toggleTodo = (id: string) => updateTodo(id, (todo) => ({
        ...todo,
        completed: !todo.completed,
        // Completing a todo stops its timer
        timer: todo.completed ? todo.timer : { ...todo.timer, isRunning: false, startTime: undefined },
    }));

    const toggleTimer = (id: string) => updateTodo(id, (todo) => ({
        ...todo,
        timer: {
            ...todo.timer,
            isRunning: !todo.timer.isRunning,
            startTime: todo.timer.isRunning ? undefined : Date.now(),
        },
    }));

    const resetTimer = (id: string) => updateTodo(id, (todo) => ({
        ...todo,
        timer: { isRunning: false, timeSpent: 0, startTime: undefined },
    }));

    const deleteTodo = (id: string) => setTodos((prev) => prev.filter((todo) => todo.id !== id));

    const startEdit = (id: string, text: string) => {
        setEditingId(id);
        setEditingText(text);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingText("");
    };

    const saveEdit = () => {
        const text = editingText.trim();
        if (text && editingId) {
            updateTodo(editingId, (todo) => ({ ...todo, text }));
        }
        cancelEdit();
    };

    const { totalTimeSpent, activeCount, completedCount } = useMemo(() => {
        const completedCount = todos.filter((todo) => todo.completed).length;
        return {
            totalTimeSpent: todos.reduce((total, todo) => total + todo.timer.timeSpent, 0),
            activeCount: todos.length - completedCount,
            completedCount,
        };
    }, [todos]);

    if (!isClient) {
        return null;
    }

    return (
        <Popover open={isExpanded} onOpenChange={setIsExpanded}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Personal todos">
                    <ListTodo className="h-5 w-5 text-emerald-600" />
                    {activeCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-semibold flex items-center justify-center">
                            {activeCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[90vw] sm:w-96 p-4 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center gap-2 mb-3">
                    <ListTodo className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-base font-semibold">Personal Todos</h3>
                </div>
                <div className="space-unified-md">
                        <div className="flex gap-2">
                            <Input
                                value={newTodoText}
                                onChange={(e) => setNewTodoText(e.target.value)}
                                placeholder="Add a personal todo..."
                                onKeyPress={(e) => e.key === "Enter" && addTodo()}
                                className="flex-1"
                            />
                            <Button onClick={addTodo} size="sm">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {todos.length > 0 && (
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>{activeCount} active, {completedCount} completed</span>
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatTime(totalTimeSpent)}</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 max-h-[50vh] sm:max-h-96 overflow-y-auto pr-1">
                            {todos.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>No personal todos yet</p>
                                    <p className="text-xs">Add one above to get started!</p>
                                </div>
                            ) : todos.map((todo) => (
                                <div
                                    key={todo.id}
                                    className={cn(
                                        "p-3 rounded-lg border transition-all min-h-[80px]",
                                        todo.completed
                                            ? "bg-muted/50 border-muted"
                                            : "bg-background border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={todo.completed}
                                            onCheckedChange={() => toggleTodo(todo.id)}
                                            className="mt-1 flex-shrink-0"
                                        />

                                        <div className="flex-1 min-w-0 space-y-3">
                                            {editingId === todo.id ? (
                                                <div className="flex gap-2 items-center">
                                                    <Input
                                                        value={editingText}
                                                        onChange={(e) => setEditingText(e.target.value)}
                                                        onKeyPress={(e) => e.key === "Enter" && saveEdit()}
                                                        className="flex-1 h-8"
                                                        autoFocus
                                                    />
                                                    <Button size="sm" variant="ghost" onClick={saveEdit} className={EDIT_BUTTON_CLASS_NAME}>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={cancelEdit} className={EDIT_BUTTON_CLASS_NAME}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className={cn(
                                                        "text-sm leading-relaxed",
                                                        todo.completed && "line-through text-muted-foreground"
                                                    )}>
                                                        {todo.text}
                                                    </p>

                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className={`flex items-center gap-1 text-xs ${todo.completed ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                                                                <Clock className={`h-3 w-3 flex-shrink-0 ${todo.completed ? "opacity-50" : ""}`} />
                                                                <span className={todo.completed ? "line-through" : ""}>{formatTime(todo.timer.timeSpent)}</span>
                                                                {todo.completed && (
                                                                    <span className="text-xs text-green-600 dark:text-green-400 font-medium ml-1">
                                                                        (Completed)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex gap-1.5">
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => toggleTimer(todo.id)}
                                                                    disabled={todo.completed}
                                                                    className={TIMER_BUTTON_CLASS_NAME}
                                                                >
                                                                    {todo.timer.isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => resetTimer(todo.id)}
                                                                    disabled={todo.completed}
                                                                    className={TIMER_BUTTON_CLASS_NAME}
                                                                >
                                                                    <Square className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-1.5 flex-shrink-0">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => startEdit(todo.id, todo.text)}
                                                                className={ICON_BUTTON_CLASS_NAME}
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => deleteTodo(todo.id)}
                                                                className={cn(ICON_BUTTON_CLASS_NAME, "text-destructive hover:text-destructive")}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                </div>
            </PopoverContent>
        </Popover>
    );
});
