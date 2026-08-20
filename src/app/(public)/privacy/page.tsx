import Link from 'next/link'
import type { Metadata } from 'next'
import { ShieldCheck, Lock, ExternalLink, CheckCircle2 } from 'lucide-react'
import { LEGAL_PROSE } from '../prose'
import { TableOfContents } from '../table-of-contents'

export const metadata: Metadata = {
  title: 'Privacy Policy — LogPup',
  description:
    'How LogPup, operated by Alta Vision (Pvt) Ltd, collects, uses, shares, and retains data — including Google user data.',
}

const LAST_UPDATED = '12 August 2026'

const SECTIONS = [
  { id: 'who-for', title: '1. Who this policy is for' },
  { id: 'data-collect', title: '2. Data we collect' },
  { id: 'how-use', title: '3. How we use data' },
  { id: 'google-limited-use', title: '4. Google user data & Limited Use' },
  { id: 'sharing', title: '5. Who we share data with' },
  { id: 'security', title: '6. Storage, security, and location' },
  { id: 'retention', title: '7. Retention' },
  { id: 'choices', title: '8. Your choices and rights' },
  { id: 'children', title: '9. Children' },
  { id: 'changes', title: '10. Changes to this policy' },
  { id: 'contact', title: '11. Contact' },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Background ambient lighting with isolated overflow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/3 h-[500px] w-[700px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-[76rem] px-6 py-12 md:px-10 md:py-16">
        {/* Header Title Block */}
        <div className="mb-12 max-w-3xl border-b border-border/70 pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 font-mono text-2xs font-bold uppercase tracking-widest text-primary">
            <ShieldCheck className="size-3.5 text-primary" />
            Alta Vision Legal &bull; Compliance
          </div>
          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Privacy Policy
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
          <main className="lg:col-span-8">
            <article className={`w-full max-w-none ${LEGAL_PROSE}`}>
              <p className="lead text-base sm:text-lg leading-relaxed text-foreground">
                LogPup (&ldquo;LogPup&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an internal
                engineering-operations application built and operated by{' '}
                <strong>Alta Vision (Pvt) Ltd</strong>, a company incorporated in Sri Lanka. This policy
                explains what data LogPup collects, why, who it is shared with, how long we keep it, and
                the choices you have. It applies to the LogPup web application and to this website.
              </p>
              <p>
                If you have any question about this policy or about data we hold on you, write to{' '}
                <a href="mailto:deeghayus@altavision.lk" className="text-primary hover:underline">
                  deeghayus@altavision.lk
                </a>.
              </p>

              {/* Section 1 */}
              <h2 id="who-for">1. Who this policy is for</h2>
              <p>
                LogPup is not a consumer product. Accounts exist for staff and collaborators of Alta Vision
                and the teams it works with. A new sign-in creates an account in a <em>pending</em> state
                and grants no access until an administrator approves it. If you are not one of those people
                and you have reached this page, there is nothing here that collects data about you.
              </p>

              {/* Section 2 */}
              <h2 id="data-collect">2. Data we collect</h2>

              <h3>2.1 Account and profile data</h3>
              <ul>
                <li>
                  <strong>From Google Sign-In:</strong> your name, email address, profile picture, and the
                  Google account identifier tied to your sign-in. This is what creates and identifies your
                  LogPup account.
                </li>
                <li>
                  <strong>Added by you or an administrator:</strong> job title, contact phone number, an
                  optional secondary contact email, and organization labels. The secondary email is contact
                  information only — it can never be used to sign in.
                </li>
              </ul>

              <h3>2.2 Google Calendar data</h3>
              <div className="my-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 font-mono text-2xs font-bold text-primary uppercase">
                  <Lock className="size-3.5" /> Scope Specification
                </div>
                <p className="mt-1 text-xs text-foreground leading-relaxed">
                  With your explicit consent, LogPup requests the{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs font-semibold text-primary">
                    https://www.googleapis.com/auth/calendar.events
                  </code>{' '}
                  scope. We use it strictly to create, update, and cancel the calendar events for meetings you schedule in LogPup, and to invite the attendees you selected.
                </p>
              </div>
              <p>
                To do this without asking you to re-authorize on every action, we store the refresh token Google issues, in our database, on your user record. It is used for nothing but the calendar operations described here, and it is deleted when your account is deleted or when you revoke LogPup&apos;s access from your Google account.
              </p>

              <h3>2.3 Content you create in LogPup</h3>
              <p>
                Apps, sprints, tasks, meetings, attendee lists, allocation percentages, comments, and
                notifications. LogPup also keeps an activity log of who changed what and when, so a team can
                reconstruct how a decision or a board came to be.
              </p>

              <h3>2.4 Meeting recordings, transcripts, and screen keyframes</h3>
              <p>
                A participant can start a recording of a meeting from within LogPup, capturing microphone
                audio and, optionally, a shared screen. What happens to it:
              </p>
              <ul>
                <li>
                  <strong>Audio is not stored by us:</strong> Audio is sent to the Google Gemini API for
                  transcription and is not written to our database or file storage. What we keep is the
                  resulting text.
                </li>
                <li>
                  <strong>Transcripts and derived notes are stored:</strong> the transcript text, per-person
                  notes, action items, deadlines, a glossary of terms used, and follow-up questions.
                </li>
                <li>
                  <strong>Screen keyframes are stored</strong> when you record a shared screen: periodic
                  still images of the shared screen, kept only when the picture meaningfully changed, held
                  in private file storage that is not publicly fetchable and served only to signed-in users
                  through an authenticated proxy.
                </li>
              </ul>
              <p>
                Recording is always a manual, per-meeting action taken by a participant. The person who
                starts a recording is responsible for informing everyone present beforehand and for having
                whatever consent applicable law requires.
              </p>

              <h3>2.5 API keys you supply</h3>
              <p>
                Meeting transcription runs on a Google Gemini API key that each user obtains themselves and
                adds in their profile. These keys are encrypted with AES-256-GCM before being written to our
                database and are used only to make Gemini requests on your behalf. You can delete a key from
                your profile at any time.
              </p>

              <h3>2.6 Technical and operational data</h3>
              <p>
                Standard server logs, plus aggregate traffic and performance measurements from Vercel
                Analytics and Vercel Speed Insights. We do not use advertising cookies, third-party
                trackers, or cross-site profiling. Session cookies are strictly necessary — they are what
                keep you signed in.
              </p>

              {/* Section 3 */}
              <h2 id="how-use">3. How we use data</h2>
              <ul>
                <li>To authenticate you and enforce role-based access.</li>
                <li>To provide the product features described on the <Link href="/home" className="text-primary hover:underline">home page</Link>.</li>
                <li>To create and maintain the Google Calendar events for meetings you schedule.</li>
                <li>To produce meeting notes and follow-ups from recordings you initiate.</li>
                <li>To keep an internal audit trail of changes.</li>
                <li>To keep the service secure, available, and debuggable.</li>
              </ul>
              <p>
                We do not sell personal data, we do not share it with advertisers, and we do not use it to
                train machine-learning models.
              </p>

              {/* Section 4: Highlighted Callout */}
              <h2 id="google-limited-use">4. Google user data and Limited Use</h2>
              <div className="my-6 rounded-2xl border-2 border-primary/50 bg-primary/5 p-6 shadow-sm">
                <div className="flex items-center gap-2 font-heading font-bold text-foreground text-sm">
                  <ShieldCheck className="size-5 text-primary" />
                  Google API Services User Data Policy Commitment
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-foreground">
                  LogPup&apos;s use and transfer of information received from Google APIs to any other app
                  will adhere to the{' '}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5"
                  >
                    Google API Services User Data Policy
                    <ExternalLink className="size-3" />
                  </a>
                  , including the Limited Use requirements.
                </p>
              </div>

              <p>Concretely, for data obtained through Google APIs:</p>
              <ul>
                <li>
                  We access your calendar <strong>only</strong> to create, update, and cancel the events for
                  meetings scheduled in LogPup. We do not read, index, or analyse the rest of your calendar.
                </li>
                <li>
                  We do not transfer it to third parties except as required to run the feature you asked
                  for, or where the law compels us.
                </li>
                <li>We do not use it for advertising, and we do not sell it.</li>
                <li>
                  We do not allow humans to read it, except with your explicit consent, for a security
                  investigation, to comply with the law, or where the data has been aggregated and
                  de-identified.
                </li>
              </ul>
              <p>
                The Gemini API key you supply is yours; requests made with it are governed by the{' '}
                <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Google Gemini API terms
                </a>{' '}
                as they apply to your key.
              </p>

              {/* Section 5: Table */}
              <h2 id="sharing">5. Who we share data with</h2>
              <p>
                We use a small set of service providers to run LogPup. They process data on our instructions
                and only as needed to deliver their service:
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/80 my-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/60">
                    <tr>
                      <th className="p-3 font-semibold text-foreground">Provider</th>
                      <th className="p-3 font-semibold text-foreground">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr>
                      <td className="p-3 font-medium text-foreground">Google LLC</td>
                      <td className="p-3 text-muted-foreground">Sign-in, Calendar events, and Gemini transcription</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground">Vercel Inc.</td>
                      <td className="p-3 text-muted-foreground">Application hosting, private file storage for keyframes and backups, analytics</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground">Neon Inc.</td>
                      <td className="p-3 text-muted-foreground">Managed PostgreSQL database with TLS encryption at rest</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground">Notion Labs Inc.</td>
                      <td className="p-3 text-muted-foreground">Optional, only when an authorized user exports a sprint to Notion or signs in with Notion</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Beyond that, we disclose data only where we are legally required to, or where it is
                necessary to investigate a security incident or enforce our{' '}
                <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
              </p>

              {/* Section 6 */}
              <h2 id="security">6. Storage, security, and location</h2>
              <ul>
                <li>All traffic to LogPup is served strictly over HTTPS.</li>
                <li>Data is held in managed infrastructure, encrypted at rest with AES-256.</li>
                <li>Stored Gemini API keys are encrypted with AES-256-GCM before DB write.</li>
                <li>Meeting keyframes are private objects served solely via authenticated proxy.</li>
                <li>Database backups run nightly and are encrypted before being written to storage.</li>
                <li>Access inside LogPup is role-gated with server-enforced authorization policies.</li>
              </ul>
              <p>
                Our providers operate globally, so your data may be processed outside Sri Lanka, including
                in the United States and the European Union. No system is perfectly secure; we take
                reasonable technical and organizational measures appropriate to an internal tool of this
                size.
              </p>

              {/* Section 7 */}
              <h2 id="retention">7. Retention</h2>
              <p>
                We keep account and workspace data for as long as your account is active and the records
                remain useful to the team&apos;s history. Deleting a record inside LogPup normally moves it
                to a recoverable trash rather than erasing it, so an accidental deletion can be undone by an
                administrator. A <strong>privacy deletion request is different</strong>: when you ask us to
                erase your personal data, we remove it permanently rather than moving it to trash, subject
                to any record we are legally obliged to keep.
              </p>

              {/* Section 8: Actionable Rights */}
              <h2 id="choices">8. Your choices and rights</h2>
              <div className="my-4 rounded-xl border border-border/80 bg-card/60 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground text-xs">Revoke Google Calendar Access:</span>
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        You can disconnect LogPup at any time from{' '}
                        <a
                          href="https://myaccount.google.com/permissions"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline font-medium"
                        >
                          myaccount.google.com/permissions
                        </a>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground text-xs">Delete Stored Gemini API Keys:</span>
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        Remove your encrypted API keys at any time directly inside your LogPup user profile.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground text-xs">Access, Correct, or Delete Records:</span>
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        Email <a href="mailto:deeghayus@altavision.lk" className="text-primary hover:underline">deeghayus@altavision.lk</a> to request record updates or transcript purges within 30 days.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 9 */}
              <h2 id="children">9. Children</h2>
              <p>
                LogPup is a workplace tool and is not directed at anyone under 16. We do not knowingly
                collect data from children.
              </p>

              {/* Section 10 */}
              <h2 id="changes">10. Changes to this policy</h2>
              <p>
                If we change this policy we will update the date at the top of the page, and for material
                changes we will notify users inside the application. Continuing to use LogPup after a change
                means you accept the updated policy.
              </p>

              {/* Section 11 */}
              <h2 id="contact">11. Contact</h2>
              <div className="rounded-xl border border-border/80 bg-card/60 p-4">
                <span className="font-heading font-bold text-foreground text-sm">Alta Vision (Pvt) Ltd</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Colombo, Sri Lanka<br />
                  Data protection contact: <a href="mailto:deeghayus@altavision.lk" className="text-primary hover:underline">deeghayus@altavision.lk</a>
                </p>
              </div>
            </article>
          </main>

          {/* Sticky Quick-Nav Sidebar (4 cols) */}
          <aside className="hidden lg:block lg:col-span-4">
            <TableOfContents sections={SECTIONS} title="Privacy Sections" />
          </aside>
        </div>
      </div>
    </div>
  )
}
