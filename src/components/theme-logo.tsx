import { cn } from "@/lib/utils"

import { LogoMark } from "./logo"

interface ThemeLogoProps {
  height?: number
  // Kept for existing callers; the lockup sizes itself from `height`
  width?: number
  className?: string
}

// Mark + wordmark, styled like the site's gradient headings; works in light and dark
export const ThemeLogo = ({ height = 50, className }: ThemeLogoProps) => (
  <div className={cn("inline-flex items-center gap-2.5", className)}>
    <LogoMark size={Math.round(height * 0.8)} />
    <span
      className="hidden min-[400px]:inline font-bold tracking-tight text-foreground"
      style={{ fontSize: Math.round(height * 0.44) }}
    >
      ScrumSpecter
    </span>
  </div>
)
