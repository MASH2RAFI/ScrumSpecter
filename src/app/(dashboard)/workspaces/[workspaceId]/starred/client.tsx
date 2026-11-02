"use client";

import { StarredList } from "@/features/stars/components/starred-list";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

export const StarredClient = () => <StarredList workspaceId={useWorkspaceId()} />;
