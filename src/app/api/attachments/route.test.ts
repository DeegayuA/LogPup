import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachments } from '@/db/schema'
import { liveApps, liveAttachments, liveTasks } from '@/db/live'

// Both attachment routes and the two server actions, with the database, the
// blob store, the session and the capability matrix mocked. The select mock
// is table-keyed (the idiom in src/features/sprints/task-actions.test.ts):
// a test says "this task exists" and "this attachment exists" independently.
const h = vi.hoisted(() => ({
  authMock: vi.fn(),
  requireCapability: vi.fn(),
  logActivity: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  selectRows: new Map<unknown, unknown[]>(),
  inserted: [] as unknown[],
  insertResult: [] as unknown[],
  updates: [] as unknown[],
  // When on, any read inner-joined to liveApps comes back empty — the shape
  // of a task whose project is in Trash.
  appTrashed: { on: false },
}))

vi.mock('@/lib/auth', () => ({ auth: h.authMock }))
vi.mock('@/features/auth/actor', () => ({ requireCapability: h.requireCapability }))
vi.mock('@/features/activity/log', () => ({ logActivity: h.logActivity }))
vi.mock('@vercel/blob', () => ({ put: h.put, get: h.get, del: h.del }))
vi.mock('@/db', () => {
  function builder(table: unknown) {
    const self: Record<string, unknown> = {}
    let trashed = false
    for (const m of ['where', 'limit', 'leftJoin', 'orderBy']) self[m] = () => self
    self.innerJoin = (joined: unknown) => {
      if (joined === liveApps && h.appTrashed.on) trashed = true
      return self
    }
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(trashed ? [] : (h.selectRows.get(table) ?? [])).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => builder(table) }),
      insert: () => ({
        values: (v: unknown) => {
          h.inserted.push(v)
          return { returning: async () => h.insertResult }
        },
      }),
      update: (table: unknown) => ({
        set: (values: unknown) => ({
          where: async () => {
            h.updates.push({ table, values })
          },
        }),
      }),
    },
  }
})

const { POST } = await import('./route')
const { GET } = await import('./[id]/route')
const { listTaskAttachments, deleteTaskAttachment } = await import('@/features/sprints/attachments-actions')

const TASK_ID = '11111111-1111-4111-8111-111111111111'
const APP_ID = '22222222-2222-4222-8222-222222222222'
const ATT_ID = '33333333-3333-4333-8333-333333333333'
const USER = 'u-1'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

// Serialised up front so the request carries a real Content-Length, as a
// browser's FormData fetch does — the route refuses a body without one.
async function uploadRequest(file: File | null, taskId: string = TASK_ID, headers: Record<string, string> = {}) {
  const form = new FormData()
  form.append('taskId', taskId)
  if (file) form.append('file', file)
  const encoded = new Response(form)
  const body = new Uint8Array(await encoded.arrayBuffer())
  return new Request('http://localhost/api/attachments', {
    method: 'POST',
    body,
    headers: {
      'content-type': encoded.headers.get('content-type') ?? '',
      'content-length': String(body.byteLength),
      ...headers,
    },
  })
}

const get = (id = ATT_ID) => GET(new Request(`http://localhost/api/attachments/${id}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  h.selectRows.clear()
  h.inserted.length = 0
  h.updates.length = 0
  h.insertResult = [{ id: ATT_ID, createdAt: new Date('2026-10-29T00:00:00Z') }]
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
  h.appTrashed.on = false
  h.authMock.mockResolvedValue({ user: { id: USER, active: true, status: 'approved' } })
  h.requireCapability.mockResolvedValue({ id: USER })
  h.put.mockResolvedValue({ pathname: 'x' })
  h.del.mockResolvedValue(undefined)
  h.selectRows.set(liveTasks, [{ id: TASK_ID, appId: APP_ID, assigneeId: USER, title: 'Fix login' }])
  h.selectRows.set(liveAttachments, [{ n: 0 }])
})

describe('POST /api/attachments', () => {
  it('stores a valid image at a random path under the TASK\'s app, never the filename', async () => {
    const res = await POST(await uploadRequest(new File([PNG], '../evil name.png', { type: 'image/png' })))
    expect(res.status).toBe(201)
    const [path, , options] = h.put.mock.calls[0]
    expect(path).toMatch(new RegExp(`^attachments/${APP_ID}/[0-9a-f-]{36}$`))
    expect(path).not.toContain('evil')
    expect(options).toMatchObject({ access: 'private', contentType: 'image/png' })
    expect(h.inserted[0]).toMatchObject({ appId: APP_ID, ownerType: 'task', ownerId: TASK_ID, name: 'evil name.png', uploadedBy: USER })
    expect(h.requireCapability).toHaveBeenCalledWith('task.edit', { appId: APP_ID, ownerId: USER })
    expect(h.logActivity).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'task', entityId: TASK_ID }))
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('attachments/')
  })

  it('answers 503 JSON when blob storage is not configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const res = await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/BLOB_READ_WRITE_TOKEN/)
    expect(h.put).not.toHaveBeenCalled()
  })

  it('refuses without a session, and a deactivated session', async () => {
    h.authMock.mockResolvedValueOnce(null)
    expect((await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))).status).toBe(401)
    h.authMock.mockResolvedValueOnce({ user: { id: USER, active: false } })
    expect((await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))).status).toBe(401)
  })

  // Regression: the proxy's pending gate never runs for /api, so a pending
  // signup's real session reached the upload.
  it('refuses a pending (unapproved) session', async () => {
    h.authMock.mockResolvedValueOnce({ user: { id: USER, active: true, status: 'pending' } })
    expect((await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))).status).toBe(401)
    expect(h.put).not.toHaveBeenCalled()
  })

  // Regression: a missing Content-Length read as 0 and let formData() buffer
  // a body of any size; the message also still said 10 MB.
  it('refuses a body with no Content-Length, or one declared too large, before parsing', async () => {
    const unsized = new Request('http://localhost/api/attachments', {
      method: 'POST',
      body: new Uint8Array(16),
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
    })
    expect(unsized.headers.has('content-length')).toBe(false)
    const res = await POST(unsized)
    expect(res.status).toBe(413)
    expect((await res.json()).error).toBe('That file is too large — the limit is 4 MB')

    const declared = await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' }), TASK_ID, {
      'content-length': String(4 * 1024 * 1024 + 64 * 1024 + 1),
    })
    expect((await POST(declared)).status).toBe(413)
    expect(h.put).not.toHaveBeenCalled()
  })

  it('treats a task in a trashed project as not found', async () => {
    h.appTrashed.on = true
    expect((await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))).status).toBe(404)
    expect(h.put).not.toHaveBeenCalled()
  })

  it('answers the same 404 for an unknown task and a forbidden one', async () => {
    h.selectRows.set(liveTasks, [])
    const missing = await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))
    h.selectRows.set(liveTasks, [{ id: TASK_ID, appId: APP_ID, assigneeId: 'other', title: 't' }])
    h.requireCapability.mockResolvedValueOnce(null)
    const forbidden = await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))
    expect(missing.status).toBe(404)
    expect(forbidden.status).toBe(404)
    expect(await missing.json()).toEqual(await forbidden.json())
    expect(h.put).not.toHaveBeenCalled()
  })

  it('rejects a malformed task id before querying', async () => {
    expect((await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' }), "x' or 1=1"))).status).toBe(400)
    expect((await POST(await uploadRequest(null))).status).toBe(400)
  })

  it.each([
    ['svg', new File(['<svg onload=alert(1)/>'], 'x.svg', { type: 'image/svg+xml' }), 415],
    ['html', new File(['<html>'], 'x.html', { type: 'text/html' }), 415],
    ['svg renamed png', new File(['<svg onload=alert(1)/>'], 'x.png', { type: 'image/png' }), 415],
    ['html renamed txt', new File(['<!doctype html><script>'], 'x.txt', { type: 'text/plain' }), 415],
  ])('rejects %s', async (_label, file, status) => {
    const res = await POST(await uploadRequest(file))
    expect(res.status).toBe(status)
    expect(h.put).not.toHaveBeenCalled()
  })

  it('rejects a file over 4 MB', async () => {
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'a.pdf', { type: 'application/pdf' })
    expect((await POST(await uploadRequest(big))).status).toBe(413)
  })

  it('enforces the per-task cap', async () => {
    h.selectRows.set(liveAttachments, [{ n: 20 }])
    expect((await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))).status).toBe(409)
    expect(h.put).not.toHaveBeenCalled()
  })

  it('removes the orphaned blob when the insert fails', async () => {
    h.insertResult = []
    const res = await POST(await uploadRequest(new File([PNG], 'a.png', { type: 'image/png' })))
    expect(res.status).toBe(500)
    expect(h.del).toHaveBeenCalledWith(h.put.mock.calls[0][0])
  })
})

describe('GET /api/attachments/[id]', () => {
  const row = { appId: APP_ID, ownerType: 'task', ownerId: TASK_ID, blobPath: 'attachments/a/b', name: 'résumé.pdf', mime: 'application/pdf' }

  beforeEach(() => {
    h.selectRows.set(liveAttachments, [row])
    h.get.mockResolvedValue({ statusCode: 200, stream: new Blob(['%PDF-']).stream(), headers: new Headers(), blob: { size: 5 } })
  })

  it('streams the file with safe headers and never exposes the blob path', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(h.requireCapability).toHaveBeenCalledWith('app.view', { appId: APP_ID })
    expect(h.get).toHaveBeenCalledWith('attachments/a/b', { access: 'private' })
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('content-disposition')).toBe(`inline; filename="r_sum_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`)
    expect([...res.headers.values()].join(' ')).not.toContain('attachments/a/b')
  })

  it('forces a download (and sandboxes) anything that is not an image or pdf', async () => {
    h.selectRows.set(liveAttachments, [{ ...row, name: 'a.txt', mime: 'text/plain' }])
    const res = await get()
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/)
    expect(res.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('answers an identical 404 for missing, forbidden, trashed-task, malformed and signed-out', async () => {
    const responses: Response[] = []
    h.selectRows.set(liveAttachments, [])
    responses.push(await get())
    h.selectRows.set(liveAttachments, [row])
    h.requireCapability.mockResolvedValueOnce(null)
    responses.push(await get())
    h.selectRows.set(liveTasks, [])
    responses.push(await get())
    responses.push(await get('../../etc'))
    h.authMock.mockResolvedValueOnce(null)
    responses.push(await get())
    for (const res of responses) {
      expect(res.status).toBe(404)
      expect(await res.text()).toBe('Not found')
    }
    expect(h.get).not.toHaveBeenCalled()
  })

  it('404s for a pending session and for a task in a trashed project', async () => {
    h.authMock.mockResolvedValueOnce({ user: { id: USER, active: true, status: 'pending' } })
    expect((await get()).status).toBe(404)
    h.appTrashed.on = true
    expect((await get()).status).toBe(404)
    expect(h.get).not.toHaveBeenCalled()
  })

  it('404s when the blob itself is gone', async () => {
    h.get.mockResolvedValueOnce(null)
    expect((await get()).status).toBe(404)
    h.get.mockRejectedValueOnce(new Error('BlobNotFoundError'))
    expect((await get()).status).toBe(404)
  })
})

describe('attachments actions', () => {
  it('lists without blob paths, with download hrefs and per-row delete rights', async () => {
    h.selectRows.set(liveAttachments, [
      { id: ATT_ID, name: 'a.png', mime: 'image/png', bytes: 3, uploadedBy: USER, uploaderName: 'Me', createdAt: new Date() },
      { id: 'other-id', name: 'b.png', mime: 'image/png', bytes: 3, uploadedBy: 'u-2', uploaderName: null, createdAt: new Date() },
    ])
    h.requireCapability.mockResolvedValueOnce({ id: USER }).mockResolvedValueOnce(null) // app.view, then task.delete
    const result = await listTaskAttachments(TASK_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data[0]).toMatchObject({ mine: true, canDelete: true, href: `/api/attachments/${ATT_ID}` })
    expect(result.data[1]).toMatchObject({ mine: false, canDelete: false, uploaderName: 'Unknown user' })
    expect(JSON.stringify(result.data)).not.toContain('blobPath')
  })

  it('refuses to list a task the viewer cannot see', async () => {
    h.requireCapability.mockResolvedValueOnce(null)
    expect(await listTaskAttachments(TASK_ID)).toEqual({ ok: false, error: 'Task not found' })
  })

  it('refuses to list the files of a task in a trashed project', async () => {
    h.appTrashed.on = true
    expect(await listTaskAttachments(TASK_ID)).toEqual({ ok: false, error: 'Task not found' })
  })

  // Regression: the uploader shortcut (task.edit at 'own') is decided from
  // ownerId alone, so somebody taken off the project could still remove files
  // they once uploaded to it.
  it('asks app.view before the uploader shortcut', async () => {
    h.selectRows.set(liveAttachments, [{ appId: APP_ID, ownerType: 'task', ownerId: TASK_ID, name: 'a.png', uploadedBy: USER }])
    h.requireCapability.mockResolvedValueOnce(null) // app.view
    expect(await deleteTaskAttachment(ATT_ID)).toEqual({ ok: false, error: 'Attachment not found' })
    expect(h.requireCapability).toHaveBeenCalledTimes(1)
    expect(h.requireCapability).toHaveBeenCalledWith('app.view', { appId: APP_ID })
    expect(h.updates).toHaveLength(0)
  })

  it('refuses to remove a file from a task in a trashed project', async () => {
    h.selectRows.set(liveAttachments, [{ appId: APP_ID, ownerType: 'task', ownerId: TASK_ID, name: 'a.png', uploadedBy: USER }])
    h.appTrashed.on = true
    expect(await deleteTaskAttachment(ATT_ID)).toEqual({ ok: false, error: 'Attachment not found' })
    expect(h.updates).toHaveLength(0)
  })

  it('soft-deletes the uploader\'s own file', async () => {
    h.selectRows.set(liveAttachments, [{ appId: APP_ID, ownerType: 'task', ownerId: TASK_ID, name: 'a.png', uploadedBy: USER }])
    expect(await deleteTaskAttachment(ATT_ID)).toEqual({ ok: true, data: undefined })
    expect(h.requireCapability).toHaveBeenCalledWith('task.edit', { appId: APP_ID, ownerId: USER })
    expect(h.updates[0]).toMatchObject({ table: attachments, values: { deletedBy: USER } })
    expect(h.del).not.toHaveBeenCalled()
  })

  it('needs task.delete to remove somebody else\'s file', async () => {
    h.selectRows.set(liveAttachments, [{ appId: APP_ID, ownerType: 'task', ownerId: TASK_ID, name: 'a.png', uploadedBy: 'u-2' }])
    h.requireCapability.mockResolvedValueOnce({ id: USER }).mockResolvedValueOnce(null) // app.view, then task.delete
    const result = await deleteTaskAttachment(ATT_ID)
    expect(result.ok).toBe(false)
    expect(h.requireCapability).toHaveBeenCalledWith('task.delete', { appId: APP_ID })
    expect(h.updates).toHaveLength(0)
  })
})
