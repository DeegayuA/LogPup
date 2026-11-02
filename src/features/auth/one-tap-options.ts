/**
 * The fixed half of the Google One Tap config, kept out of the component so a
 * plain .ts test can pin it (vitest here has no DOM to render the component).
 */
export type OneTapConfig = {
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  use_fedcm_for_prompt?: boolean
}

// `satisfies` because a spread hides misspelled keys from tsc: a typo here
// would compile and GSI would quietly fall back to its own default.
export const ONE_TAP_OPTIONS = {
  // FedCM is required: Chrome has removed the legacy third-party-cookie path
  // One Tap relied on, so without this the prompt never appears in a current
  // Chrome at all.
  use_fedcm_for_prompt: true,
  // Never sign someone in without a deliberate click. auto_select would resume
  // the last account on page load, which on a shared machine means signing in
  // as whoever used it last.
  auto_select: false,
  // Off on purpose. GSI treats ANY click on the page as "tap outside" and
  // aborts the pending FedCM request, which it then logs as
  // "FedCM get() rejects with AbortError" — and the most common click on
  // /sign-in is the "Continue with Google" button itself. The FedCM prompt is
  // browser UI with its own close control, so nothing is lost.
  cancel_on_tap_outside: false,
  context: 'signin',
} as const satisfies OneTapConfig
