import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, themeInitScript } from "@/components/shell/theme-provider";
import { PwaRegister } from "@/features/pwa/pwa";
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
      className={`${satoshi.variable} ${cabinet.variable} ${geistMono.variable} h-full antialiased`}
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
          <Toaster />
          <PwaRegister />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
