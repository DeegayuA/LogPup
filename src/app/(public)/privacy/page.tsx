import Link from 'next/link'
import type { Metadata } from 'next'
import { LEGAL_PROSE } from '../prose'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How LogPup, operated by Alta Vision (Pvt) Ltd, collects, uses, shares, and retains data — including Google user data.',
}

const LAST_UPDATED = '12 August 2026'

/**
 * Google's OAuth verification checks this page directly: it must be publicly
 * reachable on the same domain as the app, linked from the home page, and it
 * must name the Google user data the app touches and carry the Limited Use
 * statement verbatim. Anything asserted here has to stay true of the code —
 * the claims below were written against src/db/schema.ts and
 * src/features/meetings/ai-actions.ts, notably that raw meeting audio is never
 * persisted (only the transcript text in meeting_recording_segments).
 */
export default function PrivacyPolicyPage() {
  return (
    /* The outer wrapper matches the 76rem the header and footer now run to,
       while the prose itself stays at max-w-3xl: legal text at 76rem would be
       a 1200px measure, which nobody can read. Left-aligned inside the wrapper
       rather than centred so this column starts on the same grid line as the
       brand mark above it. */
    <div className="mx-auto w-full max-w-[76rem] px-6 py-16 md:px-10">
      <article className={`w-full max-w-3xl ${LEGAL_PROSE}`}>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6">
          LogPup (&ldquo;LogPup&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an internal
          engineering-operations application built and operated by{' '}
          <strong>Alta Vision (Pvt) Ltd</strong>, a company incorporated in Sri Lanka. This policy
          explains what data LogPup collects, why, who it is shared with, how long we keep it, and
          the choices you have. It applies to the LogPup web application and to this website.
        </p>
        <p>
          If you have any question about this policy or about data we hold on you, write to{' '}
          <a href="mailto:deeghayus@altavision.lk">deeghayus@altavision.lk</a>.
        </p>

        <h2>1. Who this policy is for</h2>
        <p>
          LogPup is not a consumer product. Accounts exist for staff and collaborators of Alta Vision
          and the teams it works with. A new sign-in creates an account in a <em>pending</em> state
          and grants no access until an administrator approves it. If you are not one of those people
          and you have reached this page, there is nothing here that collects data about you.
        </p>

        <h2>2. Data we collect</h2>

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
        <p>
          With your consent, LogPup requests the{' '}
          <code>https://www.googleapis.com/auth/calendar.events</code> scope. We use it to create,
          update, and cancel the calendar events for meetings you schedule in LogPup, and to invite
          the attendees you selected. To do this without asking you to re-authorize on every action,
          we store the refresh token Google issues, in our database, on your user record. It is used
          for nothing but the calendar operations described here, and it is deleted when your account
          is deleted or when you revoke LogPup&apos;s access from your Google account.
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
            <strong>Audio is not stored by us.</strong> Audio is sent to the Google Gemini API for
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

        <h2>3. How we use data</h2>
        <ul>
          <li>To authenticate you and enforce role-based access.</li>
          <li>To provide the product features described on the <Link href="/home">home page</Link>.</li>
          <li>To create and maintain the Google Calendar events for meetings you schedule.</li>
          <li>To produce meeting notes and follow-ups from recordings you initiate.</li>
          <li>To keep an internal audit trail of changes.</li>
          <li>To keep the service secure, available, and debuggable.</li>
        </ul>
        <p>
          We do not sell personal data, we do not share it with advertisers, and we do not use it to
          train machine-learning models.
        </p>

        <h2>4. Google user data and Limited Use</h2>
        <p>
          <strong>
            LogPup&apos;s use and transfer of information received from Google APIs to any other app
            will adhere to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </strong>
        </p>
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
          <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">
            Google Gemini API terms
          </a>{' '}
          as they apply to your key.
        </p>

        <h2>5. Who we share data with</h2>
        <p>
          We use a small set of service providers to run LogPup. They process data on our instructions
          and only as needed to deliver their service:
        </p>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Google LLC</td>
              <td>Sign-in, Calendar events, and Gemini transcription</td>
            </tr>
            <tr>
              <td>Vercel Inc.</td>
              <td>Application hosting, private file storage for keyframes and backups, analytics</td>
            </tr>
            <tr>
              <td>Neon Inc.</td>
              <td>Managed PostgreSQL database</td>
            </tr>
            <tr>
              <td>Notion Labs Inc.</td>
              <td>Optional, only when a user exports a sprint to Notion or signs in with Notion</td>
            </tr>
          </tbody>
        </table>
        <p>
          Beyond that, we disclose data only where we are legally required to, or where it is
          necessary to investigate a security incident or enforce our{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>

        <h2>6. Storage, security, and location</h2>
        <ul>
          <li>All traffic to LogPup is served over HTTPS.</li>
          <li>
            Data is held in our providers&apos; managed infrastructure, which is encrypted at rest.
          </li>
          <li>Stored Gemini API keys are additionally encrypted by us with AES-256-GCM.</li>
          <li>
            Meeting keyframes are stored as private objects and served only through an authenticated
            proxy.
          </li>
          <li>Database backups run nightly and are encrypted before being written to storage.</li>
          <li>
            Access inside LogPup is role-based, and every write is authorized on the server rather
            than in the browser.
          </li>
        </ul>
        <p>
          Our providers operate globally, so your data may be processed outside Sri Lanka, including
          in the United States and the European Union. No system is perfectly secure; we take
          reasonable technical and organizational measures appropriate to an internal tool of this
          size.
        </p>

        <h2>7. Retention</h2>
        <p>
          We keep account and workspace data for as long as your account is active and the records
          remain useful to the team&apos;s history. Deleting a record inside LogPup normally moves it
          to a recoverable trash rather than erasing it, so an accidental deletion can be undone by an
          administrator. A <strong>privacy deletion request is different</strong>: when you ask us to
          erase your personal data, we remove it permanently rather than moving it to trash, subject
          to any record we are legally obliged to keep.
        </p>

        <h2>8. Your choices and rights</h2>
        <ul>
          <li>
            <strong>Revoke Google access</strong> at any time at{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              myaccount.google.com/permissions
            </a>
            . Calendar syncing stops immediately; meetings already in LogPup remain, and events
            already on your calendar stay there until you delete them.
          </li>
          <li>
            <strong>Delete your Gemini API keys</strong> yourself, from your LogPup profile.
          </li>
          <li>
            <strong>Access, correct, or delete your personal data</strong> — email{' '}
            <a href="mailto:deeghayus@altavision.lk">deeghayus@altavision.lk</a> and we will respond
            within 30 days.
          </li>
          <li>
            <strong>Ask us to remove a recording&apos;s transcript, notes, or keyframes</strong> — the
            same address.
          </li>
        </ul>

        <h2>9. Children</h2>
        <p>
          LogPup is a workplace tool and is not directed at anyone under 16. We do not knowingly
          collect data from children.
        </p>

        <h2>10. Changes to this policy</h2>
        <p>
          If we change this policy we will update the date at the top of the page, and for material
          changes we will notify users inside the application. Continuing to use LogPup after a change
          means you accept the updated policy.
        </p>

        <h2>11. Contact</h2>
        <p>
          Alta Vision (Pvt) Ltd, Sri Lanka
          <br />
          Data protection contact:{' '}
          <a href="mailto:deeghayus@altavision.lk">deeghayus@altavision.lk</a>
        </p>
      </article>
    </div>
  )
}
