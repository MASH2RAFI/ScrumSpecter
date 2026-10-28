"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { JoinByLinkForm } from "@/features/workspaces/components/join-by-link-form";

interface JoinWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const JoinWorkspaceModal = ({ isOpen, onClose }: JoinWorkspaceModalProps) => (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
                <DialogTitle>Join a workspace</DialogTitle>
                <DialogDescription>Paste the invite link someone shared with you.</DialogDescription>
            </DialogHeader>
            <JoinByLinkForm onCancel={onClose} onJoined={onClose} />
        </DialogContent>
    </Dialog>
);
