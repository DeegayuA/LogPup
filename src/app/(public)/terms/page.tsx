import Link from 'next/link'
import type { Metadata } from 'next'
import { LEGAL_PROSE } from '../prose'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms under which Alta Vision (Pvt) Ltd makes LogPup available to its team and collaborators.',
}

const LAST_UPDATED = '12 August 2026'

/**
 * Supplied to Google as the consent screen's "Terms of Service" URL, so this
 * has to stay publicly reachable for the same reason /privacy does (see the
 * comment in ../layout.tsx and the matcher in src/proxy.ts).
 */
export default function TermsOfServicePage() {
  return (
    /* Same wrapper as /privacy: 76rem outside to match the header and footer,
       with the prose held at max-w-3xl and left-aligned inside it so the text
       column starts on the same grid line as the brand mark above. */
    <div className="mx-auto w-full max-w-[76rem] px-6 py-16 md:px-10">
      <article className={`w-full max-w-3xl ${LEGAL_PROSE}`}>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6">
          These terms govern your use of LogPup, an internal engineering-operations application
          provided by <strong>Alta Vision (Pvt) Ltd</strong>, a company incorporated in Sri Lanka
          (&ldquo;Alta Vision&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By signing in to LogPup you
          agree to them. If you do not agree, do not sign in.
        </p>

        <h2>1. Who may use LogPup</h2>
        <p>
          LogPup is provided for the staff and collaborators of Alta Vision and the teams it works
          with. It is not a public service. Signing in creates an account in a pending state that
          carries no access; an administrator must approve it, and may decline without giving a
          reason. You must be at least 16 years old.
        </p>

        <h2>2. Your account</h2>
        <p>
          You are responsible for everything done under your account. Keep your sign-in credentials to
          yourself, do not share your account, and tell us at{' '}
          <a href="mailto:deeghayus@altavision.lk">deeghayus@altavision.lk</a> as soon as you suspect
          it has been compromised. Where an administrator issues you a starter password, you must
          replace it with your own on first sign-in.
        </p>

        <h2>3. Acceptable use</h2>
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

        <h2>4. Meeting recording and consent</h2>
        <p>
          LogPup can record microphone audio and a shared screen when a participant chooses to start a
          recording. Recording people has legal consequences that vary by jurisdiction.{' '}
          <strong>
            If you start a recording, you are responsible for telling every participant beforehand and
            for obtaining whatever consent the applicable law requires
          </strong>
          , and for not recording conversations you have no right to record. Alta Vision provides the
          feature; it does not obtain that consent on your behalf.
        </p>

        <h2>5. Third-party services and your own API keys</h2>
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

        <h2>6. Content and intellectual property</h2>
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

        <h2>7. Privacy</h2>
        <p>
          Our handling of personal data — including data obtained from Google APIs — is described in
          the <Link href="/privacy">Privacy Policy</Link>, which forms part of these terms.
        </p>

        <h2>8. Availability and warranties</h2>
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

        <h2>9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Alta Vision (Pvt) Ltd is not liable for indirect,
          incidental, special, consequential, or punitive damages, nor for lost profits, lost revenue,
          or lost or corrupted data, arising from your use of LogPup. Where liability cannot be
          excluded, our total aggregate liability is limited to LKR 25,000 or the amount you paid us
          for LogPup in the preceding twelve months, whichever is greater. LogPup is normally provided
          at no charge to its users.
        </p>

        <h2>10. Suspension and termination</h2>
        <p>
          An administrator may suspend or deactivate your account at any time, including when you
          leave Alta Vision or the engagement ends, or where these terms have been breached. You may
          stop using LogPup at any time and ask us to delete your account. Provisions that by their
          nature should survive termination — intellectual property, disclaimers, limitation of
          liability, governing law — do.
        </p>

        <h2>11. Changes to these terms</h2>
        <p>
          We may update these terms. The date at the top of this page changes when we do, and material
          changes will be announced inside the application. Continued use after a change means you
          accept the revised terms.
        </p>

        <h2>12. Governing law</h2>
        <p>
          These terms are governed by the laws of the Democratic Socialist Republic of Sri Lanka, and
          the courts of Colombo have exclusive jurisdiction over any dispute arising from them.
        </p>

        <h2>13. Contact</h2>
        <p>
          Alta Vision (Pvt) Ltd, Sri Lanka
          <br />
          <a href="mailto:deeghayus@altavision.lk">deeghayus@altavision.lk</a>
        </p>
      </article>
    </div>
  )
}
