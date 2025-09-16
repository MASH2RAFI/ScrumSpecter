import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-unified text-sm font-semibold transition-unified focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-unified hover:bg-primary/90 hover:shadow-unified-md",
        destructive:
          "bg-red-500 text-white shadow-unified hover:bg-red-600 hover:shadow-unified-md",
        outline:
          "border-2 border-border bg-background shadow-unified hover:bg-muted/50 hover:border-primary/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-unified hover:bg-secondary/80",
        ghost:
          "border-transparent shadow-none hover:bg-accent hover:text-accent-foreground",
        muted:
          "bg-muted text-muted-foreground shadow-unified hover:bg-muted/80",
        tertiary:
          "bg-primary/10 text-primary border-transparent shadow-none hover:bg-primary/20",
        success:
          "bg-emerald-500 text-white shadow-unified hover:bg-emerald-600 hover:shadow-unified-md",
        warning:
          "bg-amber-500 text-white shadow-unified hover:bg-amber-600 hover:shadow-unified-md",
        info:
          "bg-blue-500 text-white shadow-unified hover:bg-blue-600 hover:shadow-unified-md"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-unified-sm px-3 text-sm",
        xs: "h-7 rounded-unified-sm px-2 text-xs",
        lg: "h-12 rounded-unified px-8 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
