"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { downloadFrom } from "../download";

// Account page: everything about the signed-in person, across their workspaces, as JSON
export const MyDataExport = () => {
    const [pending, setPending] = useState(false);

    const run = async () => {
        setPending(true);
        try {
            await downloadFrom("/api/export/me", "my-scrumspecter-data.json");
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setPending(false);
        }
    };

    return (
        <section className="space-y-3 rounded-lg border p-4">
            <div>
                <h3 className="font-semibold">My data</h3>
                <p className="text-sm text-muted-foreground">
                    Your account, workspaces, the tasks assigned to you and the change requests you sent, as one JSON file.
                </p>
            </div>
            <Button type="button" variant="outline" disabled={pending} onClick={run}>
                <DownloadIcon className="mr-1.5 size-4" />
                {pending ? "Exporting…" : "Download my data"}
            </Button>
        </section>
    );
};
