export function canEditUser(sessionUserId: string, targetUserId: string): boolean {
  return sessionUserId !== targetUserId
}

// Guards against demoting or deactivating the last SUPERADMIN. Takes the
// count of OTHER active superadmins (excluding the target being changed) —
// zero means the change under consideration would leave the workspace with
// none.
//
// Generalized from the old last-admin guard when the two-role model expanded.
// It is specifically superadmin, not admin: superadmin is the only seat that
// can grant superadmin, so a workspace with none has no route back and no way
// to run the danger zone. An admin-less workspace is recoverable by a
// superadmin; a superadmin-less one is not recoverable at all.
export function wouldLeaveNoSuperadmins(otherActiveSuperadminCount: number): boolean {
  return otherActiveSuperadminCount === 0
}
