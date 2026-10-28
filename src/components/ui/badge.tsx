import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { TaskStatus } from "@/features/tasks/types"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-accent",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        outline: "text-foreground",
        
        [TaskStatus.TODO] :
          "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-400/15 dark:text-slate-300",
        [TaskStatus.IN_PROGRESS] :
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
        [TaskStatus.IN_REVIEW] :
          "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
        [TaskStatus.DONE] :
          "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
        [TaskStatus.BACKLOG] :
          "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
