import Link from 'next/link'
import { Calendar, ShieldCheck, Lock, ExternalLink, FileText, CheckCircle2 } from 'lucide-react'
import { SpotlightCard } from './spotlight-card'

export function ScopeNotice() {
  return (
    <SpotlightCard
      spotlightColor="rgba(16, 185, 129, 0.15)"
      className="scroll-mt-24 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 via-card/60 to-card/90 p-6 md:p-10 shadow-lg backdrop-blur-sm"
    >
      <div id="notice" className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-mono text-2xs font-semibold text-primary uppercase">
              <ShieldCheck className="size-3.5" /> Google OAuth Security &amp; Scope
            </div>
            <h3 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Why LogPup requests Google Calendar access.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              LogPup is designed to keep your engineering studio in sync with the tools your team already uses every day.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-2xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1 rounded bg-muted px-2 py-1">
              <Lock className="size-3 text-primary" /> AES-256-GCM Encrypted
            </span>
            <span className="flex items-center gap-1 rounded bg-muted px-2 py-1">
              <CheckCircle2 className="size-3 text-primary" /> Limited Use Compliant
            </span>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground font-medium">
            When you schedule a meeting in LogPup, we automatically create the matching event on your Google Calendar and send invitations to the attendees you designated.
          </p>

          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/60 px-3.5 py-2 font-mono text-xs text-foreground break-all">
            <Calendar className="size-4 shrink-0 text-primary" />
            <span>https://www.googleapis.com/auth/calendar.events</span>
          </div>

          <p className="text-xs text-muted-foreground">
            This is the only sensitive Google scope LogPup requests, and it is strictly limited to meetings created within the system. LogPup does not read your personal emails, does not sell or transfer user data, and never uses your data for advertising or AI model training.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-xs">
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Manage Google Permissions <ExternalLink className="size-3" />
            </a>
            <span className="text-border">&bull;</span>
            <Link href="/privacy" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <FileText className="size-3" /> Privacy Policy
            </Link>
            <span className="text-border">&bull;</span>
            <Link href="/terms" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </SpotlightCard>
  )
}
