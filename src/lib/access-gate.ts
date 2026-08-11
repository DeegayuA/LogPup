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
