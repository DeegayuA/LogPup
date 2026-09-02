import Link from 'next/link'
import type { Metadata } from 'next'
import { ShieldAlert, Scale } from 'lucide-react'
import { LEGAL_PROSE } from '../prose'
import { TableOfContents } from '../table-of-contents'

/**
 * PUBLICLY REACHABLE ON PURPOSE — do not put this behind auth.
 *
 * Google's OAuth review team fetches this URL directly, with no session,
 * before granting the sensitive `calendar.events` scope, and rejects the
 * application if it redirects to a login screen. That is why `home|privacy|
 * terms` are excluded from the auth matcher in src/proxy.ts.
 *
 * Dropping that exclusion breaks verification silently: nothing a signed-in
 * user does would ever reveal it, because a signed-in user is never redirected.
 * The failure surfaces weeks later as a refused scope.
 */
export const metadata: Metadata = {
  title: 'Terms of Service — LogPup',
  description:
    'The terms under which Alta Vision (Pvt) Ltd makes LogPup available to its team and collaborators.',
}

const LAST_UPDATED = '12 August 2026'

const TERMS_SECTIONS = [
  { id: 'who-may-use', title: '1. Who may use LogPup' },
  { id: 'your-account', title: '2. Your account' },
  { id: 'acceptable-use', title: '3. Acceptable use' },
  { id: 'meeting-recording', title: '4. Meeting recording & consent' },
  { id: 'third-party-api', title: '5. Third-party services & API keys' },
  { id: 'ip-content', title: '6. Content & intellectual property' },
  { id: 'privacy-ref', title: '7. Privacy policy' },
  { id: 'warranties', title: '8. Availability & warranties' },
  { id: 'liability', title: '9. Limitation of liability' },
  { id: 'termination', title: '10. Suspension & termination' },
  { id: 'changes-terms', title: '11. Changes to these terms' },
  { id: 'governing-law', title: '12. Governing law' },
  { id: 'contact-terms', title: '13. Contact' },
]

export default function TermsOfServicePage() {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Background ambient lighting with isolated overflow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-40 right-1/3 h-[500px] w-[700px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-[76rem] px-6 py-12 md:px-10 md:py-16">
        {/* Header Title Block */}
        <div className="mb-12 max-w-3xl border-b border-border/70 pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 font-mono text-2xs font-bold uppercase tracking-widest text-primary">
            <Scale className="size-3.5 text-primary" />
            Alta Vision Legal &bull; Terms
          </div>
          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Terms of Service
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">Last updated: {LAST_UPDATED}</span>
            <span>&bull;</span>
            <span>Alta Vision (Pvt) Ltd, Colombo, Sri Lanka</span>
          </div>
        </div>

        {/* 2-Column Layout with Sticky Quick-Nav on Desktop */}
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Main Legal Content Column (8 cols) */}
          {/* `min-w-0` — same grid-item rule as privacy/page.tsx and the authed
              shell. Applied here too even though this page measures clean today:
              the two share a layout and a content shape, so the one that happens
              not to hold a wide element yet is one long URL away from the same
              60px overflow. */}
          <main className="min-w-0 lg:col-span-8">
            <article className={`w-full max-w-none ${LEGAL_PROSE}`}>
              <p className="lead text-base sm:text-lg leading-relaxed text-foreground">
                These terms govern your use of LogPup, an internal engineering-operations application
                provided by <strong>Alta Vision (Pvt) Ltd</strong>, a company incorporated in Sri Lanka
                (&ldquo;Alta Vision&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By signing in to LogPup you
                agree to them. If you do not agree, do not sign in.
              </p>

              {/* Section 1 */}
              <h2 id="who-may-use">1. Who may use LogPup</h2>
              <p>
                LogPup is provided for the staff and collaborators of Alta Vision and the teams it works
                with. It is not a public service. Signing in creates an account in a pending state that
                carries no access; an administrator must approve it, and may decline without giving a
                reason. You must be at least 16 years old.
              </p>

              {/* Section 2 */}
              <h2 id="your-account">2. Your account</h2>
              <p>
                You are responsible for everything done under your account. Keep your sign-in credentials to
                yourself, do not share your account, and tell us at{' '}
                <a href="mailto:deeghayus@altavision.lk" className="text-primary hover:underline">
                  deeghayus@altavision.lk
                </a>{' '}
                as soon as you suspect it has been compromised. Where an administrator issues you a starter
                password, you must replace it with your own on first sign-in.
              </p>

              {/* Section 3 */}
              <h2 id="acceptable-use">3. Acceptable use</h2>
              <p>You agree not to:</p>
              <ul>
                <li>access data or areas of LogPup that your role does not grant you;</li>
                <li>probe, scan, or attempt to defeat the authentication or authorization controls;</li>
                <li>upload malware, or content that is unlawful or that infringes someone&apos;s rights;</li>
                <li>
                  export or share workspace content — team data, meeting notes, transcripts — outside Alta
                  Vision and the relevant client team, except where your role at Alta Vision permits it;
                </li>
                <li>
                  use LogPup to build a competing product, or scrape it in bulk by automated means without
                  our written permission;
                </li>
                <li>interfere with the availability of the service for others.</li>
              </ul>

              {/* Section 4: Recording Notice Callout */}
              <h2 id="meeting-recording">4. Meeting recording and consent</h2>
              <div className="my-5 rounded-2xl border border-chart-1/40 bg-chart-1/5 p-5">
                <div className="flex items-center gap-2 font-heading font-bold text-foreground text-sm">
                  <ShieldAlert className="size-4.5 text-chart-1" />
                  Recording Consent Responsibility
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground">
                  LogPup can record microphone audio and a shared screen when a participant chooses to start a
                  recording. Recording people has legal consequences that vary by jurisdiction.{' '}
                  <strong>
                    If you start a recording, you are responsible for telling every participant beforehand and
                    for obtaining whatever consent the applicable law requires
                  </strong>
                  , and for not recording conversations you have no right to record. Alta Vision provides the
                  feature; it does not obtain that consent on your behalf.
                </p>
              </div>

              {/* Section 5 */}
              <h2 id="third-party-api">5. Third-party services and your own API keys</h2>
              <p>
                LogPup connects to services we do not control — Google Sign-In and Google Calendar, the
                Google Gemini API, and optionally Notion. Your use of those services is governed by their own
                terms, and we are not responsible for them.
              </p>
              <p>
                Meeting transcription uses a Google Gemini API key that you supply. You confirm you are
                entitled to use that key, you remain bound by Google&apos;s terms and quotas for it, and you
                are responsible for any cost or rate-limiting it incurs. You can delete your keys from your
                profile at any time.
              </p>

              {/* Section 6 */}
              <h2 id="ip-content">6. Content and intellectual property</h2>
              <p>
                Content entered into LogPup in the course of work for Alta Vision or its clients — apps,
                sprints, tasks, meetings, notes, transcripts — belongs to Alta Vision or the relevant client
                under the arrangements that already govern that work. Nothing in these terms transfers
                ownership of it to us beyond that.
              </p>
              <p>
                The LogPup application, its source code, its design, and the Alta Vision and LogPup names and
                marks remain the property of Alta Vision (Pvt) Ltd. These terms grant you a limited,
                revocable, non-transferable right to use LogPup for its intended purpose, and nothing more.
              </p>

              {/* Section 7 */}
              <h2 id="privacy-ref">7. Privacy</h2>
              <p>
                Our handling of personal data — including data obtained from Google APIs — is described in
                the <Link href="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</Link>, which forms part of these terms.
              </p>

              {/* Section 8 */}
              <h2 id="warranties">8. Availability and warranties</h2>
              <p>
                LogPup is provided <strong>&ldquo;as is&rdquo;</strong> and{' '}
                <strong>&ldquo;as available&rdquo;</strong>. We may change, suspend, or discontinue any part
                of it, and we do not promise uninterrupted or error-free operation, that AI-generated notes
                and transcripts are accurate, or that data will never be lost. To the fullest extent
                permitted by law we disclaim all warranties, express or implied, including merchantability,
                fitness for a particular purpose, and non-infringement.
              </p>
              <p>
                AI-generated meeting notes, action items, and deadlines are drafts produced by an automated
                system. Check them before relying on them for any decision that matters.
              </p>

              {/* Section 9 */}
              <h2 id="liability">9. Limitation of liability</h2>
              <p>
                To the fullest extent permitted by law, Alta Vision (Pvt) Ltd is not liable for indirect,
                incidental, special, consequential, or punitive damages, nor for lost profits, lost revenue,
                or lost or corrupted data, arising from your use of LogPup. Where liability cannot be
                excluded, our total aggregate liability is limited to LKR 25,000 or the amount you paid us
                for LogPup in the preceding twelve months, whichever is greater. LogPup is normally provided
                at no charge to its users.
              </p>

              {/* Section 10 */}
              <h2 id="termination">10. Suspension and termination</h2>
              <p>
                An administrator may suspend or deactivate your account at any time, including when you
                leave Alta Vision or the engagement ends, or where these terms have been breached. You may
                stop using LogPup at any time and ask us to delete your account. Provisions that by their
                nature should survive termination — intellectual property, disclaimers, limitation of
                liability, governing law — do.
              </p>

              {/* Section 11 */}
              <h2 id="changes-terms">11. Changes to these terms</h2>
              <p>
                We may update these terms. The date at the top of this page changes when we do, and material
                changes will be announced inside the application. Continued use after a change means you
                accept the revised terms.
              </p>

              {/* Section 12 */}
              <h2 id="governing-law">12. Governing law</h2>
              <p>
                These terms are governed by the laws of the Democratic Socialist Republic of Sri Lanka, and
                the courts of Colombo have exclusive jurisdiction over any dispute arising from them.
              </p>

              {/* Section 13 */}
              <h2 id="contact-terms">13. Contact</h2>
              <div className="rounded-xl border border-border/80 bg-card/60 p-4">
                <span className="font-heading font-bold text-foreground text-sm">Alta Vision (Pvt) Ltd</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Colombo, Sri Lanka<br />
                  Inquiries: <a href="mailto:deeghayus@altavision.lk" className="text-primary hover:underline">deeghayus@altavision.lk</a>
                </p>
              </div>
            </article>
          </main>

          {/* Sticky Quick-Nav Sidebar (4 cols) */}
          <aside className="hidden lg:block lg:col-span-4">
            <TableOfContents sections={TERMS_SECTIONS} title="Terms Sections" />
          </aside>
        </div>
      </div>
    </div>
  )
}
