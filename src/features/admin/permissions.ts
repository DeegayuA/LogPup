export function canEditUser(sessionUserId: string, targetUserId: string): boolean {
  return sessionUserId !== targetUserId
}
