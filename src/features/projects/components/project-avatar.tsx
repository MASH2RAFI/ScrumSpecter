import { cn } from "@/lib/utils"; 

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Vibrant gradient palette for project avatars
const projectColors = [
    "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg",
    "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg", 
    "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg",
    "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg",
    "bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg",
    "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg",
    "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg",
    "bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg",
    "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg",
    "bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg",
];

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
    // Generate consistent color based on name
    const colorIndex = name.charCodeAt(0) % projectColors.length;
    const projectColor = projectColors[colorIndex];

    return (
        <Avatar className={cn("size-5 rounded-md",className)}>
            <AvatarFallback className={cn(
                "font-semibold text-sm uppercase rounded-md",
                projectColor,
                fallbackClassName
            )}>
                {name[0]}
            </AvatarFallback>
        </Avatar>
    ) 
}