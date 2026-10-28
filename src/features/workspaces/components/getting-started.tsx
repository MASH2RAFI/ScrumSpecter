"use client";

import { FileTextIcon, LinkIcon, PlusIcon } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";

import { HeadingReveal } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BulkSetup } from "./bulk-input";
import { CreateWorkspaceWithProjectForm } from "./create-workspace-with-project-form";
import { JoinByLinkForm } from "./join-by-link-form";

const WAYS = ["create", "join", "bulk"] as const;

// /workspaces/create: the three ways into ScrumSpecter for someone without a workspace (or
// adding another): start one, join one from an invite link, or set one up from bulk commands
export const GettingStarted = () => {
    // In the URL, so a link can open a particular way (?start=join)
    const [way, setWay] = useQueryState("start", parseAsStringEnum([...WAYS]).withDefault("create"));

    return (
        <div className="w-full space-y-6">
            <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                    <HeadingReveal>Get started</HeadingReveal>
                </h1>
                <p className="text-muted-foreground">Start a workspace for your team, join one you&apos;ve been invited to, or set one up from a list of commands.</p>
            </div>

            <Tabs value={way} onValueChange={(value) => setWay(value as (typeof WAYS)[number])}>
                <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="create" className="gap-2 py-2">
                        <PlusIcon className="size-4 shrink-0" aria-hidden />
                        Create
                    </TabsTrigger>
                    <TabsTrigger value="join" className="gap-2 py-2">
                        <LinkIcon className="size-4 shrink-0" aria-hidden />
                        Join
                    </TabsTrigger>
                    <TabsTrigger value="bulk" className="gap-2 py-2">
                        <FileTextIcon className="size-4 shrink-0" aria-hidden />
                        Bulk input
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="mt-4">
                    <CreateWorkspaceWithProjectForm />
                </TabsContent>

                <TabsContent value="join" className="mt-4">
                    <Card>
                        <CardContent className="space-y-4 p-7">
                            <div>
                                <h2 className="text-xl font-bold">Join a workspace</h2>
                                <p className="text-sm text-muted-foreground">Paste the invite link someone shared with you.</p>
                            </div>
                            <JoinByLinkForm />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bulk" className="mt-4">
                    <Card>
                        <CardContent className="p-7">
                            <BulkSetup />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
