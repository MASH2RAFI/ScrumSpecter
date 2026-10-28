"use client";

import { useState, type FormEvent } from "react";
import { UserPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCreatePlaceholder } from "../api/use-placeholders";

// Admins: someone to assign tasks to before they join
export const AddPlaceholderForm = ({ workspaceId }: { workspaceId: string }) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const { mutate, isPending } = useCreatePlaceholder();

    const submit = (event: FormEvent) => {
        event.preventDefault();
        mutate({ workspaceId, name, email: email || undefined }, {
            onSuccess: () => { setName(""); setEmail(""); },
        });
    };

    return (
        <form onSubmit={submit} className="space-y-2 rounded-md border border-dashed p-3" aria-label="Add a placeholder">
            <p className="text-sm font-medium">Add a placeholder</p>
            <p className="text-xs text-muted-foreground">
                Assign tasks to someone who hasn&apos;t joined yet, like &quot;Designer (TBD)&quot;. With their email, the tasks become
                theirs automatically when they join.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                    <Label htmlFor="placeholder-name" className="sr-only">Placeholder name</Label>
                    <Input id="placeholder-name" placeholder="Name, e.g. Designer (TBD)" value={name}
                        onChange={(e) => setName(e.target.value)} required maxLength={60} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="placeholder-email" className="sr-only">Their email (optional)</Label>
                    <Input id="placeholder-email" type="email" placeholder="Their email (optional)" value={email}
                        onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" disabled={isPending}>
                    <UserPlusIcon className="mr-1.5 size-4" />
                    Add
                </Button>
            </div>
        </form>
    );
};
