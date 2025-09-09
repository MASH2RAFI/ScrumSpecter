"use client";

import dynamic from "next/dynamic";
import { LucideProps } from "lucide-react";
import { IconType } from "react-icons";

// Common Lucide icons that are frequently used
const commonIcons = {
  Calendar: dynamic(() => import("lucide-react").then((mod) => mod.Calendar)),
  ChevronLeft: dynamic(() => import("lucide-react").then((mod) => mod.ChevronLeft)),
  ChevronRight: dynamic(() => import("lucide-react").then((mod) => mod.ChevronRight)),
  Plus: dynamic(() => import("lucide-react").then((mod) => mod.Plus)),
  Settings: dynamic(() => import("lucide-react").then((mod) => mod.Settings)),
  Loader: dynamic(() => import("lucide-react").then((mod) => mod.Loader)),
  Search: dynamic(() => import("lucide-react").then((mod) => mod.Search)),
  Filter: dynamic(() => import("lucide-react").then((mod) => mod.Filter)),
  MoreHorizontal: dynamic(() => import("lucide-react").then((mod) => mod.MoreHorizontal)),
  Edit: dynamic(() => import("lucide-react").then((mod) => mod.Edit)),
  Trash: dynamic(() => import("lucide-react").then((mod) => mod.Trash)),
  Eye: dynamic(() => import("lucide-react").then((mod) => mod.Eye)),
  Check: dynamic(() => import("lucide-react").then((mod) => mod.Check)),
  X: dynamic(() => import("lucide-react").then((mod) => mod.X)),
  User: dynamic(() => import("lucide-react").then((mod) => mod.User)),
  Users: dynamic(() => import("lucide-react").then((mod) => mod.Users)),
  Folder: dynamic(() => import("lucide-react").then((mod) => mod.Folder)),
  FileText: dynamic(() => import("lucide-react").then((mod) => mod.FileText)),
  Clock: dynamic(() => import("lucide-react").then((mod) => mod.Clock)),
  AlertCircle: dynamic(() => import("lucide-react").then((mod) => mod.AlertCircle)),
  Info: dynamic(() => import("lucide-react").then((mod) => mod.Info)),
  CheckCircle: dynamic(() => import("lucide-react").then((mod) => mod.CheckCircle)),
  XCircle: dynamic(() => import("lucide-react").then((mod) => mod.XCircle)),
} as const;

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: keyof typeof commonIcons;
  size?: number;
}

export const Icon = ({ name, size = 16, ...props }: IconProps) => {
  const IconComponent = commonIcons[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in common icons`);
    return null;
  }
  
  return <IconComponent size={size} {...props} />;
};

// For dynamic icon loading when not in common icons
export const DynamicIcon = ({ 
  icon: IconComponent, 
  size = 16, 
  ...props 
}: { 
  icon: IconType; 
  size?: number; 
} & Omit<LucideProps, 'ref'>) => {
  return <IconComponent size={size} {...props} />;
};
