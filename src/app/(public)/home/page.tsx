import type { CSSProperties, ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PlateBriefing, PlateCapacity, PlateWriteup } from './plates'
import { Fortnight } from './fortnight'
import { RevealScope } from './reveal-scope'

export const metadata: Metadata = {
  // `absolute` rather than a plain string: the root layout sets
  // template: "%s · LogPup" (src/app/layout.tsx), which a bare string opts
  // into, and this title already opens with the product name — so the tab and
  // the SERP entry both read "LogPup — engineering ops for Alta Vision teams ·
  // LogPup". Google's brand verification compares this title against the name
  // on the consent screen, and the doubled mark is exactly the kind of
  // inconsistency that check exists to catch.
  title: { absolute: 'LogPup — engineering ops for Alta Vision teams' },
  description:
    'LogPup tracks the apps a studio runs, who works on them, what each team ships this sprint, and what happened in every meeting.',
}

/**
 * The public front door. Google's OAuth review team opens the "Application
 * home page" URL from the consent screen before it will approve the sensitive
 * `calendar.events` scope, and it must load with no session, describe what the
 * app does, and link to the privacy policy — all three are checked.
 *
 * It is set as an editorial record rather than as a landing page because
 * LogPup is not for sale: there is no signup, no pricing and no funnel, so
 * every persuasion device a marketing page reaches for would be describing a
 * product that does not exist. The page documents instead. That is also what
 * pays for the whitespace, the single call to action, and an index of
 * capabilities with no icons on it — the numerals do the wayfinding, and
 * icons are the thing that makes a feature list read as generic.
 *
 * Two hard constraints shaped the composition rather than fighting it. The
 * <h1> has to be the literal string "LogPup" (a prior submission was rejected
 * for a name mismatch against the consent screen), and an editorial page
 * wants exactly one enormous headline — so the product name IS the nameplate.
 * And the reviewer may arrive with no session and no scripting, which is why
 * the reveal architecture is inverted: see reveal-scope.tsx.
 */

const RISE =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out motion-safe:[animation-fill-mode:backwards]'

/**
 * The same entrance for the two elements that are the LCP candidates — minus
 * the fade.
 *
 * Chrome does not count fully transparent text as painted, so an LCP element
 * that starts at `opacity: 0` reports its paint only when the fade finishes.
 * The h1 and the tagline were both doing exactly that, and the tagline held
 * at zero for a further 60ms, so the page was charging itself roughly half a
 * second of LCP for its own entrance — on the one route whose job is to make
 * a first impression on a reviewer.
 *
 * Movement alone costs nothing: the text is opaque in the first frame and
 * merely finishes travelling. Everything below the fold keeps the fade.
 */
const RISE_LCP =
  'motion-safe:animate-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out motion-safe:[animation-fill-mode:backwards]'

const LINK =
  'rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

// `ring-ring` at full strength, not the `ring-ring/50` buttonVariants ships.
// That half-opacity ring is tuned to sit directly against a button's own fill;
// lifted onto an offset ring over --background it drops under the 3:1 that
// WCAG 1.4.11 requires of a focus indicator. These are the only two CTAs on the
// page, and LINK above already rings at full strength — the keyboard path to
// the primary action should not be fainter than the one to a footnote.
const CTA =
  'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full sm:w-auto'

/** Section eyebrows and dateline labels. A <span>, never a heading: the page
 *  runs h1 then exactly eight h2s and an eyebrow promoted to h3 would put a
 *  level below a level it does not belong to. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      /* Reveals FIRST in its section (index 0), before the heading it labels.
         A section whose heading arrives alone reads as one element animating;
         label, then title, then rule reads as a page being set. The order is
         the one the eye takes anyway, so the motion follows reading instead of
         competing with it. */
      data-reveal
      style={{ '--reveal-index': 0 } as CSSProperties}
      className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase"
    >
      {children}
    </span>
  )
}

/**
 * The section rules are real elements rather than a `border-t` utility
 * because they animate: a border cannot be scaled from its left edge, and the
 * draw is the page's second motion behaviour. `data-rule` is what
 * reveal-scope.tsx looks for.
 */
function Rule({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      data-rule
      aria-hidden
      className={cn('h-px w-full bg-border', className)}
      /* Last of the three (index 2), and on a longer curve than the text — the
         rule should finish ruling off after the words have landed, not race
         them. A caller-supplied style still wins, so a rule that needs its own
         position in a sequence can say so. */
      style={{ '--reveal-index': 2, ...style } as CSSProperties}
    />
  )
}

function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      data-reveal
      /* Second: one beat after the eyebrow that labels it. */
      style={{ '--reveal-index': 1 } as CSSProperties}
      className={cn(
        'max-w-[21ch] font-heading text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em] text-foreground',
        className,
      )}
    >
      {children}
    </h2>
  )
}

/* --- §02 contents -------------------------------------------------------- */

const INDEX = [
  {
    n: '01',
    name: 'Dashboard',
    detail:
      "The morning briefing: what's due soon, what's overdue, what you still owe someone, and today's meetings.",
  },
  {
    n: '02',
    name: 'Work log',
    detail: 'One entry a day, self-scored: what I did, and how much of the plan I got through.',
  },
  {
    n: '03',
    name: 'Apps',
    detail: 'A record per product: status, stack, lead, health, repo metadata, and the people on it.',
  },
  {
    n: '04',
    name: 'People',
    detail:
      'Allocation per person per app, and a bar that turns amber at 80% before anyone burns out.',
  },
  {
    n: '05',
    name: 'Sprints',
    detail: 'A board you can drag, a backlog, check-ins, and per-role move permissions.',
  },
  { n: '06', name: 'Roadmap', detail: 'Every app on one timeline, with a line drawn through today.' },
  {
    n: '07',
    name: 'Meetings',
    detail: 'Schedule here; the Google Calendar event and the invitations follow.',
  },
  {
    n: '08',
    name: 'Meeting write-ups',
    detail:
      'Record in the browser, with or without your screen; get per-person notes, action items and deadlines in English and Sinhala.',
  },
  {
    n: '09',
    name: 'Command centre',
    detail: '⌘K over every app, person, task, sprint and meeting.',
  },
  {
    n: '10',
    name: 'Access',
    detail:
      'Two roles, every change authorised on the server, and an audit log across apps, people, sprints, meetings and work logs.',
  },
] as const

/* --- §00 dateline -------------------------------------------------------- */

function DatelineCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 lg:col-span-4">
      <Eyebrow>{label}</Eyebrow>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

export default function PublicHomePage() {
  return (
    <div id="record-root" className="mx-auto w-full max-w-[76rem] px-6 md:px-10">
      <RevealScope rootId="record-root" />

      {/* §00 — MASTHEAD */}
      <section className="flex flex-col justify-end pt-16 pb-16 sm:min-h-[78svh] sm:pb-20">
        <div className={cn('flex flex-col gap-6', RISE_LCP)}>
          <Eyebrow>Alta Vision (Pvt) Ltd · Colombo · Internal tool</Eyebrow>
          {/* The product name is the <h1>, not the tagline. Google's review
              compares the consent screen's app name against the home page and
              rejected the first submission for a mismatch — a name that
              appears only in the header chrome is easy for that check to miss.
              Locked at weight 700, not 800 or 900: Cabinet Grotesk is a
              variable face whose glyph WIDTH moves with weight, so line breaks
              at 10rem would differ between environments where the axis
              resolves differently, and its upper axis goes blobby at this
              size anyway. */}
          <h1 className="font-heading text-[clamp(4.5rem,15vw,10.5rem)] leading-[0.82] font-bold tracking-[-0.04em] text-foreground">
            LogPup
          </h1>
        </div>

        <p
          className={cn(
            'mt-6 max-w-[19ch] font-heading text-[clamp(1.75rem,4vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-foreground',
            RISE_LCP,
            'motion-safe:[animation-delay:60ms]',
          )}
        >
          The watchdog for your team&apos;s apps, people, and sprints.
        </p>

        <div className={cn('mt-8 flex flex-col gap-6', RISE, 'motion-safe:[animation-delay:120ms]')}>
          <p className="max-w-[56ch] text-base leading-relaxed text-muted-foreground">
            An engineering-operations HQ for one software studio. Every product in flight, everyone
            on it and how loaded they are, what ships this sprint, what each person actually did
            {/* lang="si" on the Sinhala word itself (WCAG 3.1.2, Language of
                Parts). Without it a screen reader on an English page reads
                these glyphs with an English voice, which is unintelligible.
                PlateWriteup already does this correctly for its Sinhala block —
                this one inline word was the exception.

                The comment sits ABOVE the sentence rather than inside it: a
                JSX comment between two words swallows the newline that was
                carrying the space, and this paragraph shipped reading
                "produced inboth English" until someone looked at the rendered
                page. */}
            today, and what was decided in every meeting — with the meeting write-ups produced in
            both English and Sinhala (<span lang="si">සිංහල</span>).
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* buttonVariants rather than <Button render={...}>: this is a
                navigation, so the accessible element should be the anchor
                itself, not a button wrapping one. */}
            <Link href="/sign-in" className={cn(buttonVariants({ size: 'lg' }), CTA)}>
              Sign in
            </Link>
            <p className="text-sm text-muted-foreground">
              Accounts are approved by an Alta Vision administrator.
            </p>
          </div>
        </div>

        {/* Drawn with a keyframe rather than through the IntersectionObserver:
            this rule is above the fold, and reveal-scope.tsx deliberately never
            touches anything already on screen. */}
        <Rule className="mt-12 rule-draw" />

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-x-10 sm:gap-y-4 lg:grid lg:grid-cols-12 lg:gap-x-6">
          <DatelineCell label="Operator">Alta Vision (Pvt) Ltd</DatelineCell>
          <DatelineCell label="Access">Approved accounts only</DatelineCell>
          <DatelineCell label="Google scope">
            {/* An in-page anchor, so a reviewer reaches the scope disclosure in
                one click from the first screen instead of scrolling past three
                plates to find it. This link is what pays for the page being
                longer than the one it replaces. */}
            <a href="#notice" className={LINK}>
              calendar.events
            </a>
          </DatelineCell>
        </div>
      </section>

      {/* §01 — THE STATEMENT */}
      <section>
        <Rule />
        <div className="grid grid-cols-1 gap-x-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <Eyebrow>01 — What this page is</Eyebrow>
            <SectionHeading>
              LogPup is not for sale. This page exists so Google can read it.
            </SectionHeading>
          </div>
          {/* Body copy deliberately does not animate. Revealing paragraphs is
              the fastest way to make an editorial page read as a template, and
              it delays the reading it is supposed to be serving. */}
          <p className="mt-6 max-w-[68ch] text-base leading-relaxed text-muted-foreground lg:col-span-5 lg:col-start-1 lg:mt-10">
            LogPup is the internal system Alta Vision runs its studio on. There is no signup, no
            pricing, no trial, and no public product. Signing in with Google creates a pending
            account with zero access until an administrator approves it. Approval is the only gate:
            any Google account can reach that queue, and none of them can reach anything else.
          </p>
          <p className="mt-6 max-w-[68ch] text-base leading-relaxed text-muted-foreground lg:col-span-5 lg:col-start-7 lg:mt-10">
            It is published here because LogPup asks Google for permission to put meetings on your
            calendar, and a person at Google opens this address, the privacy policy and the terms
            before granting it. So the honest thing to do is describe the tool plainly, in public,
            and let the description be the marketing.
          </p>

          {/* The paragraph above says the description is the marketing. This
              is the description doing it: the product's smallest real object,
              drawn to its own rules, rather than a claim about how good the
              product is.

              Placed at the end of §01 rather than under §02's heading — §02 is
              "Ten things live in here", and this is not one of the ten — and
              deliberately low enough on the page that the observer has always
              classified it as below the fold, which is what lets it write
              itself rather than appearing already written. */}
          <div className="mt-14 lg:col-span-12 lg:mt-20">
            <Fortnight />
          </div>
        </div>
      </section>

      {/* §02 — THE INDEX */}
      <section>
        <Rule />
        <div className="grid grid-cols-1 gap-x-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col gap-6 lg:col-span-10">
            <Eyebrow>02 — Contents</Eyebrow>
            <SectionHeading>Ten things live in here.</SectionHeading>
            <p className="max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
              The ten a new colleague meets first. There is more behind the sign-in —
              notifications, admin tools, the activity feed, exports.
            </p>
          </div>

          {/* No links and no hover state, on purpose: nothing in this list is
              reachable without a session, so dressing the rows as interactive
              would be a lie the design should not tell. */}
          <div className="mt-10 lg:col-span-10 lg:col-start-1">
            <ol>
              {INDEX.map((row, i) => (
                <li key={row.n}>
                  {/* The cascade is on the RULES only, 40ms apart across ten
                      rows. Staggering ten lines of text is the cheap version
                      of this move: it would hold the list's content back for
                      400ms to no purpose, so every name and description here
                      is readable from the first frame. */}
                  <Rule style={{ transitionDelay: `${i * 40}ms` }} />
                  <div className="grid gap-x-6 py-4 md:grid-cols-[3.5rem_minmax(0,15rem)_1fr] md:py-5">
                    {/* `md:contents` dissolves this wrapper into the grid above
                        it, so the number and the name share a baseline on a
                        phone and become their own columns from md — one markup
                        shape instead of two. */}
                    <div className="flex items-baseline gap-3 md:contents">
                      <span className="font-mono text-sm text-muted-foreground">{row.n}</span>
                      <span className="font-heading text-xl leading-snug font-bold text-foreground">
                        {row.name}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground md:mt-0 md:text-base">
                      {row.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <Rule style={{ transitionDelay: `${INDEX.length * 40}ms` }} />
          </div>
        </div>
      </section>

      {/* §03 — PLATE I */}
      <section>
        <Rule />
        <div className="grid grid-cols-1 gap-x-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <Eyebrow>03 — Plate I</Eyebrow>
            <SectionHeading>Open it at nine and the day is already assembled.</SectionHeading>
            <p className="max-w-[54ch] text-base leading-relaxed text-muted-foreground">
              What&apos;s due, what&apos;s late, what you still owe someone, and what&apos;s on the
              calendar in the next few hours — on one screen, before anyone has to ask for a status
              update.
            </p>
          </div>
          <div className="mt-10 lg:col-span-12 lg:col-start-1">
            <PlateBriefing />
          </div>
        </div>
      </section>

      {/* §04 — PLATE II */}
      <section>
        <Rule />
        <div className="grid grid-cols-1 gap-x-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <Eyebrow>04 — Plate II</Eyebrow>
            <SectionHeading>The bar goes amber before the person does.</SectionHeading>
            <p className="max-w-[56ch] text-base leading-relaxed text-muted-foreground">
              Allocation is a real number per person per app, so &ldquo;she&apos;s fine&rdquo;
              becomes 86%. Anything from 80% is amber, and 112% shows up as a separate overflow
              segment instead of quietly clipping at full. You can ask what any week looked like as
              of a date — and the colour is never the only signal: the band is written out in words
              and read aloud to screen readers.
            </p>
          </div>
          <div className="mt-10 lg:col-span-12 lg:col-start-1">
            <PlateCapacity />
          </div>
        </div>
      </section>

      {/* §05 — PLATE III */}
      <section>
        <Rule />
        <div className="grid grid-cols-1 gap-x-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <Eyebrow>05 — Plate III</Eyebrow>
            <SectionHeading>Record the meeting. Get the meeting back as text.</SectionHeading>
            <p className="max-w-[58ch] text-base leading-relaxed text-muted-foreground">
              A participant starts the recording in the browser — audio, or audio with the shared
              screen — and whoever starts it is responsible for telling everyone in the room first.
              Gemini returns per-person notes, action items with deadlines, a glossary of the terms
              that got thrown around, and the questions nobody answered, which resurface as prep
              before the next meeting for the same app.
            </p>
            {/* Weight and colour carry the emphasis rather than size or a box.
                The claim is deliberately narrow and deliberately checkable:
                audio genuinely is never persisted, but screen keyframes are
                (meeting_screenshots in src/db/schema.ts, private Blob storage
                behind /api/meeting-keyframes), and a retention promise on the
                page a reviewer reads while judging a sensitive scope has to be
                true in both halves. */}
            <p className="max-w-[58ch] text-base leading-relaxed font-medium text-foreground">
              The audio is never kept — only the transcript text, and, if you shared your screen,
              the frames where the screen changed.
            </p>
          </div>
          <div className="mt-10 lg:col-span-12 lg:col-start-1">
            <PlateWriteup />
          </div>
        </div>
      </section>

      {/* §06 — THE NOTICE */}
      <section id="notice" className="scroll-mt-16">
        <Rule />
        <div className="grid grid-cols-1 gap-x-6 py-16 lg:grid-cols-12 lg:py-20">
          {/* The only block indented off column 1 — the exception is what makes
              it read as a set-apart statement rather than one more section. */}
          <div className="flex flex-col gap-6 lg:col-span-8 lg:col-start-2">
            <Eyebrow>06 — Notice</Eyebrow>
            <SectionHeading>Why LogPup asks for your calendar.</SectionHeading>
            {/* Larger and un-muted, inverting the page's normal hierarchy. A
                full-bleed inverted band was the more dramatic option and was
                rejected: --primary at 0.44 lightness on a 0.22 ink ground is
                unreadable in light theme, so every link inside would need
                special-casing, and this is exactly the block where links must
                be maximally obvious to a human reviewer. */}
            <p className="max-w-[62ch] text-lg leading-relaxed text-foreground">
              When you schedule a meeting in LogPup, we create the matching event on your Google
              Calendar and invite the people you picked, so it lands where your team already looks.
              Editing or cancelling the meeting in LogPup updates the same event.
            </p>
            {/* Plain text in the server HTML — no accordion, no dialog, no
                "read more". `break-all` so the 48-character URL wraps inside
                its own block instead of forcing the whole page to scroll
                sideways at 375px. */}
            <code className="w-fit max-w-full rounded-sm bg-muted px-2 py-1 font-mono text-sm break-all text-foreground">
              https://www.googleapis.com/auth/calendar.events
            </code>
            <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              That is the only Google scope LogPup requests, and it is used for nothing else. LogPup
              creates, updates and deletes the events it made; it does not read your calendar, does
              not sell or transfer Google user data, and does not use it for advertising or to train
              models. You can withdraw this access at any time at{' '}
              <a
                href="https://myaccount.google.com/permissions"
                className={LINK}
                target="_blank"
                rel="noreferrer"
              >
                myaccount.google.com/permissions
              </a>
              . The{' '}
              <Link href="/privacy" className={LINK}>
                Privacy Policy
              </Link>{' '}
              sets out the full detail, including our Google API Services Limited Use commitment,
              and the{' '}
              <Link href="/terms" className={LINK}>
                Terms of Service
              </Link>{' '}
              cover the rest.
            </p>
          </div>
        </div>
        <Rule />
      </section>

      {/* §07 — THE DOOR */}
      <section>
        <div className="grid grid-cols-1 gap-x-6 py-20 lg:grid-cols-12 lg:py-32">
          {/* Headline and CTA rise as one unit with no stagger between the two
              columns: staggering them makes the deliberate bottom-alignment
              look like a bug rather than a decision. */}
          <div data-reveal className="flex flex-col gap-6 lg:col-span-7">
            <Eyebrow>07 — Access</Eyebrow>
            <h2 className="max-w-[21ch] font-heading text-[clamp(2rem,5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.03em] text-foreground">
              Signing in gets you a pending account and nothing else.
            </h2>
            <p className="max-w-[52ch] text-base leading-relaxed text-muted-foreground">
              Sign in with Google and LogPup creates an account with no access at all, then puts it
              in a queue. Someone at Alta Vision approves it, or it stays where it is. There is no
              public signup and never was. Google One Tap opens the same pending account the same way;
              passkeys and administrator-issued passwords only sign you into one that already exists.
            </p>
          </div>
          <div
            data-reveal
            className="mt-10 flex flex-col gap-4 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:self-end"
          >
            {/* The second and final appearance of --primary at strength on the
                whole page. Keeping the working colour to exactly two moments
                is what makes both of them read as the action; a competing
                "Learn more" was rejected because there is nowhere else to go. */}
            <Link href="/sign-in" className={cn(buttonVariants({ size: 'lg' }), CTA)}>
              Sign in
            </Link>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {['Sign-in methods', 'Google', 'Passkey', 'One Tap', 'Password'].map(
                (method, index) => (
                  <span key={method} className="flex items-center gap-3">
                    {index > 0 ? (
                      <span aria-hidden className="hidden text-muted-foreground sm:inline">
                        ·
                      </span>
                    ) : null}
                    <span className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">
                      {method}
                    </span>
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* §08 — COLOPHON */}
      <section>
        <Rule />
        <div className="grid grid-cols-1 gap-x-6 py-16 lg:grid-cols-12 lg:py-24">
          <div className="flex flex-col gap-4 lg:col-span-6">
            <Eyebrow>08 — Colophon</Eyebrow>
            {/* The page closes by getting smaller. After a 10rem nameplate a
                second large gesture here would read as a second masthead. */}
            <h2 className="font-heading text-2xl leading-snug font-bold tracking-tight text-foreground">
              Built and operated by Alta Vision (Pvt) Ltd, Sri Lanka.
            </h2>
            <p className="max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
              LogPup is an internal tool. It is not sold, licensed, or offered to the public.
              Questions about the tool, about this site, or about the data it holds go to{' '}
              <a href="mailto:deeghayus@altavision.lk" className={LINK}>
                deeghayus@altavision.lk
              </a>
              .
            </p>
          </div>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-x-10 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <div className="flex flex-col gap-1">
              <Eyebrow>Operator</Eyebrow>
              <span className="text-sm text-foreground">Alta Vision (Pvt) Ltd</span>
            </div>
            <div className="flex flex-col gap-1">
              <Eyebrow>Location</Eyebrow>
              <span className="text-sm text-foreground">Colombo, Sri Lanka</span>
            </div>
            <div className="flex flex-col gap-1">
              <Eyebrow>Set in</Eyebrow>
              <span className="text-sm text-foreground">Cabinet Grotesk &amp; Satoshi</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
