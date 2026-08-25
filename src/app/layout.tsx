import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, themeInitScript } from "@/components/shell/theme-provider";
import { PwaRegister } from "@/features/pwa/pwa";
import { MaintenanceMount } from "@/features/maintenance/components/maintenance-mount";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

// Body text — Satoshi (variable). Exposed as --font-sans.
const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Variable.woff2", weight: "300 900", style: "normal" },
    { path: "./fonts/Satoshi-VariableItalic.woff2", weight: "300 900", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

// Headings — Cabinet Grotesk (variable). Exposed as --font-heading.
const cabinet = localFont({
  src: "./fonts/CabinetGrotesk-Variable.woff2",
  weight: "400 900",
  variable: "--font-heading",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

// Sinhala glyphs — Noto Sans Sinhala (variable), exposed as --font-sinhala and
// listed FIRST in the sans/heading stacks (globals.css). Safe to put first
// because the face is restricted to the Sinhala block below: Latin never
// matches it and keeps Satoshi/Cabinet, while Sinhala stops depending on
// whichever face the exporting machine happens to ship (Sinhala Sangam MN on
// macOS, Nirmala UI on Windows, Noto on Android) — which made the A4 export
// re-wrap and re-paginate per machine and mixed two bold treatments in one
// heading. ZWJ/ZWNJ ride along so conjuncts shape inside one font run.
const notoSinhala = localFont({
  src: "./fonts/NotoSansSinhala-Variable.woff2",
  weight: "100 900",
  variable: "--font-sinhala",
  display: "swap",
  // No synthetic size-adjusted fallback face: it would claim every character
  // and shadow the Latin faces listed after it.
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0D80-0DFF, U+200C-200D" }],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "LogPup", template: "%s · LogPup" },
  description: "The watchdog for your team's apps, people, and sprints.",
  applicationName: "LogPup",
  appleWebApp: { capable: true, title: "LogPup", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${satoshi.variable} ${cabinet.variable} ${notoSinhala.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Sets the theme class on <html> BEFORE first paint, so the page
            never renders light and then flips to dark.

            next/script with beforeInteractive: Next serialises this into the
            initial HTML and never re-renders a raw <script> through React on
            the client — which is what React 19's "script tag while rendering"
            console error fires on. A bare <script dangerouslySetInnerHTML>
            here (and the type-toggling InlineScript before it) still hit that
            warning whenever the RSC tree re-rendered in dev.

            The key it reads is the same constant the provider writes; see
            THEME_STORAGE_KEY in components/shell/theme-provider.tsx. */}
        <Script id="logpup-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          {/* App-wide, and outside (app) on purpose: the sign-in screen needs
              the maintenance notice and the console command too. Suspended so
              the window read can never delay first paint — the freeze itself
              is enforced server-side, not by this rendering. */}
          <Suspense fallback={null}>
            <MaintenanceMount />
          </Suspense>
          <Toaster />
          <PwaRegister />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
