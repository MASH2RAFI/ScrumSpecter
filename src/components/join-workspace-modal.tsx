"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface JoinWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const JoinWorkspaceModal = ({ isOpen, onClose }: JoinWorkspaceModalProps) => {
    const [inviteCode, setInviteCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleJoin = async () => {
        if (!inviteCode.trim()) {
            toast.error("Please enter an invite code");
            return;
        }

        setIsLoading(true);
        try {
            // Extract workspace ID and invite code from the full invite link
            // Expected format: /workspaces/{workspaceId}/join/{inviteCode}
            const parts = inviteCode.trim().split('/');
            const workspaceIdIndex = parts.findIndex(part => part === 'workspaces') + 1;
            const joinIndex = parts.findIndex(part => part === 'join') + 1;

            if (workspaceIdIndex < parts.length && joinIndex < parts.length) {
                const workspaceId = parts[workspaceIdIndex];
                const code = decodeURIComponent(parts[joinIndex]);

                // Make API call to join workspace
                const response = await fetch(`/api/workspaces/${workspaceId}/join`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code }),
                });

                if (response.ok) {
                    const result = await response.json();
                    toast.success("Successfully joined workspace!");
                    router.push(`/workspaces/${result.data.$id}`);
                    onClose();
                    setInviteCode("");
                } else {
                    const error = await response.json();
                    toast.error(error.error || "Failed to join workspace");
                }
            } else {
                toast.error("Invalid invite link format");
            }
        } catch (error) {
            console.error("Error joining workspace:", error);
            toast.error("Failed to join workspace");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setInviteCode("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Join Workspace</DialogTitle>
                    <DialogDescription>
                        Enter the invite link or code to join a workspace.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="invite-code" className="text-right">
                            Invite Link
                        </Label>
                        <Input
                            id="invite-code"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            placeholder="Paste invite link here..."
                            className="col-span-3"
                            disabled={isLoading}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleJoin}
                        disabled={isLoading || !inviteCode.trim()}
                    >
                        {isLoading ? "Joining..." : "Join Workspace"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
