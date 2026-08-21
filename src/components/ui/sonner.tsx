"use client"

import { useTheme } from "@/components/shell/theme-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Sonner reads a SEPARATE variable set per variant. With only
          // --normal-* defined, toast.error() rendered pixel-identical to
          // toast.success() — same surface, same border, same muted text — and
          // the single 16px icon was the entire difference between "saved" and
          // "that was rejected". A failure that looks like a confirmation is
          // worse than no toast: people dismiss it without reading.
          //
          // Tinted with color-mix against the SAME popover surface rather than
          // given flat colours, so one declaration is correct in both themes
          // and no new colour enters the system. Text stays on the strong token
          // so contrast comes from the foreground, not from a loud background.
          "--error-bg": "color-mix(in oklch, var(--destructive) 12%, var(--popover))",
          "--error-border": "color-mix(in oklch, var(--destructive) 38%, var(--border))",
          "--error-text": "var(--destructive)",
          "--success-bg": "color-mix(in oklch, var(--primary) 12%, var(--popover))",
          "--success-border": "color-mix(in oklch, var(--primary) 38%, var(--border))",
          "--success-text": "var(--primary)",
          "--warning-bg": "color-mix(in oklch, var(--chart-1) 12%, var(--popover))",
          "--warning-border": "color-mix(in oklch, var(--chart-1) 38%, var(--border))",
          "--warning-text": "var(--chart-1)",
          "--info-bg": "var(--popover)",
          "--info-border": "var(--border)",
          "--info-text": "var(--popover-foreground)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Was "cn-toast", which is defined in no stylesheet in this repo —
          // grep returns this line and nothing else. A class name that styles
          // nothing reads like intent and silently does nothing.
          //
          // The message is the toast's whole payload here (server actions hand
          // back one sentence, e.g. "A trainee or intern needs a named
          // supervisor"), so it must wrap rather than clip, and the icon must
          // stay top-aligned once it does.
          toast: "items-start gap-2.5",
          title: "text-sm leading-snug font-medium text-balance",
          description: "text-xs leading-snug text-muted-foreground",
          icon: "mt-px shrink-0",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
