export function canEditUser(sessionUserId: string, targetUserId: string): boolean {
  return sessionUserId !== targetUserId
}

// Guards against demoting/deactivating the last admin. Takes the count of
// OTHER active admins (i.e. excluding the target being changed) — zero means
// the change under consideration would leave the system with no admin.
export function wouldLeaveNoAdmins(otherActiveAdminCount: number): boolean {
  return otherActiveAdminCount === 0
}
