import { revalidatePath } from 'next/cache'

/**
 * Busts the /admin page's cache.
 *
 * Every soft delete anywhere in the app changes what the admin page's Trash
 * card shows, and every restore/purge changes it back — but the delete paths
 * live in meetings/sprints/tasks/ai-actions, none of which had any reason to
 * know about /admin before soft deletes existed. Without this, an admin who
 * had the page open (or cached) saw a Trash card that was missing the row
 * that was just trashed, which reads as "the delete didn't work".
 *
 * Called from the shared per-feature revalidate helpers rather than from each
 * action, so a delete path added later inherits it instead of having to
 * remember it. Not a server action itself — a plain function imported into
 * 'use server' modules (which may only export async functions of their own).
 */
export function revalidateAdmin(): void {
  revalidatePath('/admin')
}
