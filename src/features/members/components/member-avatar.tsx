import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Gradient palette shared by member and project avatars
export const AVATAR_COLORS = [
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

// Consistent color per name, based on its first character
export const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

interface MemberAvatarProps {
    name: string;
    className?: string;
    fallbackClassName?: string;
};

export const MemberAvatar = ({
    name,
    className,
    fallbackClassName,
}: MemberAvatarProps) => (
    <Avatar className={cn("size-5 transition border border-neutral-300 rounded-md", className)}>
        <AvatarFallback className={cn(
            "font-semibold text-sm uppercase rounded-md flex items-center justify-center",
            getAvatarColor(name),
            fallbackClassName
        )}>
            {name.charAt(0).toUpperCase()}
        </AvatarFallback>
    </Avatar>
);
