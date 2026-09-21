import { can, type Actor } from '@/features/auth/capabilities'

/**
 * THE GATE `/people/[id]` never had (security review F7). The directory
 * (`user.view.directory`) lists everyone for every seat by design — that is
 * the org chart. The DETAIL page is what `user.view.detail` actually scopes
 * (editor/member: 'scoped', stakeholder: 'none'), and nothing enforced it, so
 * a client-seat stakeholder could open any employee's page and a scoped
 * editor/member could open people outside their own projects.
 *
 * A THIN WRAPPER, deliberately: `can()` already resolves self (the `own`
 * arm — ownerId === actor.id short-circuits before the scope check, so a
 * member sees their own page with zero shared apps), any-of app overlap (the
 * `appIds` arm), and the 'all'/'none' seats. Nothing here may re-derive that
 * — a second "who can see whom" rule is exactly how the matrix and the
 * enforcement drift apart (see capabilities.ts's own warning against role
 * comparisons).
 */
export function canViewPerson(
  actor: Actor,
  target: { id: string; appIds: readonly string[] },
): boolean {
  return can(actor, 'user.view.detail', { ownerId: target.id, appIds: target.appIds })
}
