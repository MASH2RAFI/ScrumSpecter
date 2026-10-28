import { useCurrent } from "@/features/auth/api/use-current";

import { useGetMembers } from "../api/use-get-members";
import { canEditWork, canManageWorkspace, canRequestChanges, canReview } from "../permissions";
import { MemberRole } from "../types";

// The signed-in person's role in a workspace and what it lets them do. The UI only hides what
// the API would refuse anyway.
export const usePermissions = ({ workspaceId }: { workspaceId: string }) => {
    const { data: user } = useCurrent();
    const { data: members, isLoading } = useGetMembers({ workspaceId });
    const me = members?.documents.find((member) => member.userId && member.userId === user?.$id);
    const role = me?.role as MemberRole | undefined;

    return {
        isLoading,
        memberId: me?.$id,
        role,
        isAdmin: canManageWorkspace(role),
        canEditWork: canEditWork(role),
        canReview: canReview(role),
        // Proposes task changes for an admin or supervisor to approve
        canRequestChanges: canRequestChanges(role),
        isViewer: role === MemberRole.VIEWER,
    };
};
