"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// Applies the account's theme (Account settings) once on each device when it changes; the
// per-browser switch still works afterwards. "device" leaves each browser to its own switch.
export function AccountTheme({ theme }: { theme: string }) {
  const { setTheme } = useTheme()

  React.useEffect(() => {
    if (theme === "device") return
    try {
      if (localStorage.getItem(APPLIED_KEY) === theme) return
      localStorage.setItem(APPLIED_KEY, theme)
    } catch {
      // Storage unavailable: apply it every visit instead
    }
    setTheme(theme)
  }, [theme, setTheme])

  return null
}

const APPLIED_KEY = "scrumspecter-account-theme"
