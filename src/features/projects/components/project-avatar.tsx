import { cn } from "@/lib/utils"; 

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ProjectAvatarProps {
    name: string;
    className?: string;
    fallbackClassName?: string;
};

export const ProjectAvatar = ({
    name,
    className,
    fallbackClassName
}: ProjectAvatarProps) => {

    return (
        <Avatar className={cn("size-5 rounded-md",className)}>
            <AvatarFallback className={cn(
                "text-primary-foreground bg-primary font-semibold text-sm uppercase rounded-md",
                fallbackClassName
            )}>
                {name[0]}
            </AvatarFallback>
        </Avatar>
    ) 
}