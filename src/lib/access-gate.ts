// Pure predicate for the open-signup + admin-approval gate (see
// src/db/schema.ts `user_status`, the signIn/jwt callbacks in
// src/lib/auth.ts, and the pending-approval redirect in src/proxy.ts).
//
// A 'rejected' user never even gets a session (the jwt callback returns null
// for them), so in practice `status` is only ever 'pending' or 'approved' by
// the time this runs in the proxy — 'rejected' is accepted here too so the
// function is a complete, honest description of the rule rather than one
// that silently assumes a precondition enforced somewhere else.
export type UserStatus = 'pending' | 'approved' | 'rejected'

export function canAccessApp(status: UserStatus, active: boolean): boolean {
  return active && status === 'approved'
}

/**
 * TWO DIFFERENT QUESTIONS, and conflating them is the bug this pair exists to
 * stop.
 *
 * `canAccessApp` asks whether somebody may use LogPup. This asks whether they
 * may be signed in AT ALL — which is strictly wider, because two states need
 * a session precisely in order to be told they have no access: 'pending' (to
 * reach /pending and finish onboarding) and deactivated (to reach
 * /deactivated, read why, and sign out). Note that `active` is deliberately
 * not a parameter here: deactivation withholds the app, never the session.
 *
 * 'rejected' is the one outcome that gets nothing. There is no page for it to
 * reach and nothing for it to do; the jwt callback in src/lib/auth.ts returns
 * null and the sign-in attempt ends on /auth-error.
 */
export function mayHoldSession(status: UserStatus): boolean {
  return status !== 'rejected'
}
