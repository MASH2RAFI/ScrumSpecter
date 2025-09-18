"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PersonalTodo {
  id: string;
  text: string;
  completed: boolean;
  timer: {
    isRunning: boolean;
    timeSpent: number; // in seconds
    startTime?: number;
  };
  createdAt: Date;
}

export const PersonalTodoWidget = React.memo(function PersonalTodoWidget() {
  const pathname = usePathname();
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isClient, setIsClient] = useState(false);

  // Set client flag on mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load todos from localStorage on mount (only on client)
  useEffect(() => {
    if (!isClient) return;
    
    const savedTodos = localStorage.getItem("personal-todos");
    if (savedTodos) {
      try {
        const parsedTodos = JSON.parse(savedTodos).map((todo: PersonalTodo & { createdAt: string }) => ({
          ...todo,
          createdAt: new Date(todo.createdAt),
        }));
        setTodos(parsedTodos);
      } catch (error) {
        console.error("Error loading todos:", error);
      }
    }
  }, [isClient]);

  // Save todos to localStorage whenever todos change (only on client)
  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem("personal-todos", JSON.stringify(todos));
  }, [todos, isClient]);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTodos(prevTodos => 
        prevTodos.map(todo => {
          if (todo.timer.isRunning && todo.timer.startTime) {
            const now = Date.now();
            const timeSpent = Math.floor((now - todo.timer.startTime) / 1000);
            return {
              ...todo,
              timer: {
                ...todo.timer,
                timeSpent: todo.timer.timeSpent + timeSpent,
                startTime: now
              }
            };
          }
          return todo;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const addTodo = useCallback(() => {
    if (newTodoText.trim()) {
      const newTodo: PersonalTodo = {
        id: Date.now().toString(),
        text: newTodoText.trim(),
        completed: false,
        timer: {
          isRunning: false,
          timeSpent: 0,
        },
        createdAt: new Date(),
      };
      setTodos(prev => [newTodo, ...prev]);
      setNewTodoText("");
    }
  }, [newTodoText]);

  const toggleTodo = useCallback((id: string) => {
    setTodos(prev => 
      prev.map(todo => {
        if (todo.id === id) {
          const newCompleted = !todo.completed;
          return {
            ...todo,
            completed: newCompleted,
            // Stop timer if task is being marked as completed
            timer: newCompleted ? {
              ...todo.timer,
              isRunning: false,
              startTime: undefined,
            } : todo.timer
          };
        }
        return todo;
      })
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  const startEdit = useCallback((id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingText.trim()) {
      setTodos(prev => 
        prev.map(todo => 
          todo.id === editingId 
            ? { ...todo, text: editingText.trim() }
            : todo
        )
      );
    }
    setEditingId(null);
    setEditingText("");
  }, [editingText, editingId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingText("");
  }, []);

  const toggleTimer = useCallback((id: string) => {
    setTodos(prev => 
      prev.map(todo => {
        if (todo.id === id) {
          const newIsRunning = !todo.timer.isRunning;
          return {
            ...todo,
            timer: {
              ...todo.timer,
              isRunning: newIsRunning,
              startTime: newIsRunning ? Date.now() : undefined,
            }
          };
        }
        return todo;
      })
    );
  }, []);

  const resetTimer = useCallback((id: string) => {
    setTodos(prev => 
      prev.map(todo => 
        todo.id === id 
          ? {
              ...todo,
              timer: {
                isRunning: false,
                timeSpent: 0,
                startTime: undefined,
              }
            }
          : todo
      )
    );
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const { totalTimeSpent, activeTodos, completedTodos } = useMemo(() => {
    const totalTimeSpent = todos.reduce((total, todo) => total + todo.timer.timeSpent, 0);
    const activeTodos = todos.filter(todo => !todo.completed);
    const completedTodos = todos.filter(todo => todo.completed);
    
    return { totalTimeSpent, activeTodos, completedTodos };
  }, [todos]);

  // Don't render until client-side mounted to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  // Only show personal todos in workspace pages (not on public pages)
  const isWorkspacePage = pathname.startsWith('/workspaces/');
  
  // Don't render on public pages
  if (!isWorkspacePage) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <Card 
        className={cn(
          "shadow-unified-lg transition-unified-slow",
          // Mobile: icon-only when collapsed, adaptive width when expanded
          "w-12 sm:w-80",
          isExpanded ? "h-[75vh] w-[90vw] sm:h-[600px] sm:w-80" : "h-12 sm:h-16",
          // Make clickable on mobile when collapsed
          !isExpanded && "sm:cursor-default cursor-pointer"
        )}
        onClick={() => {
          // Only handle click on mobile when collapsed
          if (typeof window !== 'undefined' && window.innerWidth < 640 && !isExpanded) {
            setIsExpanded(true);
          }
        }}
      >
        <CardHeader className="pb-1 pt-2 px-2 sm:px-6">
          <div className="flex items-center justify-center sm:justify-between">
            {/* Mobile: Show only icon and badge when collapsed */}
            <div className="flex items-center gap-1 sm:gap-2">
              <ListTodo className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg hidden sm:block">
                Personal Todos
              </CardTitle>
              {todos.length > 0 && (
                <Badge className="bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs min-w-[20px] h-5 flex items-center justify-center hidden sm:flex">
                  {activeTodos.length}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0 hidden sm:flex"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-unified-md px-2 sm:px-6">
            {/* Mobile close button */}
            <div className="flex justify-center sm:hidden mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-8 w-8 p-0"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>
            {/* Add new todo */}
            <div className="flex gap-2">
              <Input
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add a personal todo..."
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                className="flex-1"
              />
              <Button onClick={addTodo} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Summary */}
            {todos.length > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{activeTodos.length} active, {completedTodos.length} completed</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(totalTimeSpent)}</span>
                </div>
              </div>
            )}

            {/* Todo list */}
            <div className="space-y-2 max-h-[50vh] sm:max-h-96 overflow-y-auto pr-1">
              {todos.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No personal todos yet</p>
                  <p className="text-xs">Add one above to get started!</p>
                </div>
              ) : (
                todos.map((todo) => (
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
                              onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                              className="flex-1 h-8"
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" onClick={saveEdit} className="h-8 w-8 p-0 focus:ring-1 focus:ring-offset-1">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 w-8 p-0 focus:ring-1 focus:ring-offset-1">
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
                            
                            {/* Timer and action buttons section */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className={`flex items-center gap-1 text-xs ${todo.completed ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                                  <Clock className={`h-3 w-3 flex-shrink-0 ${todo.completed ? 'opacity-50' : ''}`} />
                                  <span className={todo.completed ? 'line-through' : ''}>{formatTime(todo.timer.timeSpent)}</span>
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
                                    className="h-7 w-7 p-0 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 focus:ring-1 focus:ring-offset-1"
                                  >
                                    {todo.timer.isRunning ? (
                                      <Pause className="h-3 w-3" />
                                    ) : (
                                      <Play className="h-3 w-3" />
                                    )}
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => resetTimer(todo.id)}
                                    disabled={todo.completed}
                                    className="h-7 w-7 p-0 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 focus:ring-1 focus:ring-offset-1"
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
                                  className="h-7 w-7 p-0 focus:ring-1 focus:ring-offset-1"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteTodo(todo.id)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive focus:ring-1 focus:ring-offset-1"
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
                ))
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
});
