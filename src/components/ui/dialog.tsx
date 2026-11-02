"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[hsl(144_18%_6%/0.45)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// A toast (e.g. its Undo button) isn't "outside": clicking it mustn't close the dialog, sheet or drawer
export const keepToastClicks = <E extends Event>(handler?: (event: E) => void) => (event: E) => {
  if ((event.target as Element | null)?.closest?.("[data-sonner-toaster]")) event.preventDefault()
  handler?.(event)
}

// Focus handling shared by Dialog, Sheet and Drawer:
// - Radix hands focus back only to a <DialogTrigger>; dialogs opened another way (from the URL, a
//   shortcut, a menu) would leave it on <body>. This notes what had focus as the dialog opens and
//   gives it back on close; when that's gone (a closed menu's item) Radix does as before.
// - Escape belongs to the layer that has focus. For a moment after a dialog opens over another
//   (while its content loads), Radix can still let the one below take Escape, which closed the task
//   panel under an open Edit dialog; the one below now stays and closes the focused one instead.
export const useLayerFocus = ({ onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown }: {
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
  onEscapeKeyDown?: (event: KeyboardEvent) => void
}) => {
  const opener = React.useRef<HTMLElement | null>(null)
  const own = React.useRef<Element | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = document.activeElement as HTMLElement | null
      own.current = event.target as Element | null
      onOpenAutoFocus?.(event)
    },
    onEscapeKeyDown: (event: KeyboardEvent) => {
      onEscapeKeyDown?.(event)
      const focused = document.activeElement?.closest("[role=dialog]")
      if (event.defaultPrevented || !own.current || !focused || own.current.contains(focused)) return
      event.preventDefault()
      focused.querySelector<HTMLElement>("[data-dialog-close]")?.click()
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      const target = opener.current
      opener.current = null
      if (event.defaultPrevented || !target?.isConnected || target === document.body) return
      event.preventDefault()
      target.focus()
    },
  }
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onInteractOutside, onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown, ...props }, ref) => {
  const layerFocus = useLayerFocus({ onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown })
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      onInteractOutside={keepToastClicks(onInteractOutside)}
      {...layerFocus}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/70 bg-card p-6 shadow-lift duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-card",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close data-dialog-close className="absolute right-4 top-4 rounded-unified-sm opacity-70 ring-offset-background transition-unified hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
)})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
