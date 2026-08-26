// The password an admin-issued reset puts on an account.
//
// SECURITY NOTE — read before changing anything here.
//
// This is a SHARED CONSTANT, chosen by the operator so a reset can be read
// down a phone without spelling out a random string. That choice has a real
// cost, and it is written down here rather than discovered later:
//
//   Between the moment an admin resets an account and the moment its owner
//   next signs in, ANYONE WHO KNOWS THAT PERSON'S EMAIL CAN SIGN IN AS THEM.
//   `mustChangePassword` pins the session to /profile (src/proxy.ts), but a
//   stranger who gets there first can simply SET the password and keep the
//   account.
//
// createUser deliberately does NOT use this — it mints a random per-user
// starter instead, for exactly this reason (see the note above createUserInput
// in actions.ts). The two paths differ ON PURPOSE; do not "unify" them by
// pointing createUser here.
//
// TO REMOVE THE WINDOW: change `resetPasswordFor` below to return
// `randomBytes(6).toString('base64url')` and surface the value to the admin
// once, the way add-user-dialog.tsx already does. Nothing else has to change —
// the action already returns the password it set.
export const STARTER_PASSWORD = '12345678'

/**
 * The password to put on an account being reset.
 *
 * A function, not a bare constant read at the call site, so the shared-vs-random
 * decision lives in ONE place and switching it is a one-line edit rather than a
 * hunt through the action.
 */
export function resetPasswordFor(): string {
  return STARTER_PASSWORD
}
