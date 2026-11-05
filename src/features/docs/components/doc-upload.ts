import { checkAttachmentMeta } from '@/features/sprints/attachments'

/**
 * POST one file onto a Docs page through the shared attachments route (form
 * field `docId`). Resolves to the new attachment or an error sentence; never
 * throws. The meta check runs first so a wrong file fails instantly instead
 * of after the upload — the route runs it again, since the client is not the
 * one deciding.
 */
export async function uploadDocFile(
  docId: string,
  file: File,
): Promise<{ ok: true; id: string; name: string; mime: string } | { ok: false; error: string }> {
  const check = checkAttachmentMeta({ name: file.name, type: file.type, size: file.size })
  if (!check.ok) return { ok: false, error: check.error }
  const body = new FormData()
  body.append('docId', docId)
  body.append('file', file)
  let response: Response
  try {
    response = await fetch('/api/attachments', { method: 'POST', body })
  } catch {
    return { ok: false, error: 'Network error — check your connection' }
  }
  const isJson = response.headers.get('content-type')?.includes('application/json')
  if (response.redirected || !isJson) return { ok: false, error: 'Your session has expired — sign in again' }
  const payload = (await response.json().catch(() => null)) as
    | { id?: unknown; name?: unknown; mime?: unknown; error?: unknown }
    | null
  if (response.ok && typeof payload?.id === 'string') {
    return {
      ok: true,
      id: payload.id,
      name: typeof payload.name === 'string' ? payload.name : file.name,
      mime: typeof payload.mime === 'string' ? payload.mime : check.mime,
    }
  }
  return { ok: false, error: typeof payload?.error === 'string' ? payload.error : 'Upload failed — try again' }
}
