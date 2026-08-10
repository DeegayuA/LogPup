export function canMoveTask(
  role: 'admin' | 'member',
  userId: string,
  assigneeId: string | null,
): boolean {
  if (role === 'admin') return true
  return assigneeId !== null && assigneeId === userId
}
