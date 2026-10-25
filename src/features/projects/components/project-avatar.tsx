import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarColor } from "@/features/members/components/member-avatar";

interface ProjectAvatarProps {
    name: string;
    className?: string;
    fallbackClassName?: string;
};

export const ProjectAvatar = ({
    name,
    className,
    fallbackClassName,
}: ProjectAvatarProps) => (
    <Avatar className={cn("size-5 rounded-md", className)}>
        <AvatarFallback className={cn(
            "font-semibold text-sm uppercase rounded-md",
            getAvatarColor(name),
            fallbackClassName
        )}>
            {name[0]}
        </AvatarFallback>
    </Avatar>
);
