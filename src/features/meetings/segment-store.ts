// Durable, on-device parking for recorded audio segments that haven't been
// transcribed yet.
//
// Why this exists: the recorder used to hold every cut segment's Blob in a
// React ref and nowhere else, so the UI's promise that "your audio is still
// here" only held for as long as the tab did. Close it, reload it, run out of
// memory, or let the OS reap a backgrounded tab, and a stretch of a meeting
// that already happened was gone with no way to get it back — the one failure
// in this whole feature that is genuinely unrecoverable, since you cannot
// re-record a conversation that already finished.
//
// So every segment is written here the moment it's cut, and deleted only once
// the server confirms it has been transcribed (its transcript then lives in
// meeting_recording_segments, which is the durable copy from that point on).
// On mount, anything still parked is picked back up and retried.
//
// IndexedDB rather than localStorage because localStorage is synchronous,
// string-only, and ~5MB — a Blob store needs none of those properties. Every
// function here is best-effort and resolves rather than throws: this is a
// safety net, and a safety net that can itself break the recording would be
// worse than no net at all.

const DB_NAME = 'logpup-recordings'
const DB_VERSION = 1
const STORE = 'segments'
const MEETING_INDEX = 'byMeeting'

/**
 * How long an untranscribed segment is kept before it's swept. Long enough
 * that "I'll finish this tomorrow" works, short enough that a browser profile
 * doesn't quietly accumulate audio from meetings nobody will ever finalize.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type ParkedSegment = {
  key: string
  meetingId: string
  index: number
  blob: Blob
  createdAt: number
}

function keyFor(meetingId: string, index: number): string {
  return `${meetingId}#${index}`
}

/**
 * Opens (and on first use creates) the object store. Resolves to null instead
 * of throwing when IndexedDB is unavailable or refuses to open — private
 * browsing modes, disabled storage, server-side rendering — so every caller
 * can treat "no durable store" as simply "no extra safety net" rather than as
 * an error path to handle.
 */
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex(MEETING_INDEX, 'meetingId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise<T | null>((resolve) => {
    let request: IDBRequest<T>
    try {
      request = work(db.transaction(STORE, mode).objectStore(STORE))
    } catch {
      db.close()
      resolve(null)
      return
    }
    request.onsuccess = () => {
      const { result } = request
      db.close()
      resolve(result)
    }
    request.onerror = () => {
      db.close()
      resolve(null)
    }
  })
}

/**
 * Parks one just-cut segment. Called BEFORE its upload starts, so even a
 * crash mid-upload leaves the audio recoverable — the server-side upsert on
 * (meetingId, index) makes a duplicate transcription harmless, which is what
 * lets this err on the side of keeping too much rather than too little.
 */
export async function parkSegment(meetingId: string, index: number, blob: Blob): Promise<void> {
  const entry: ParkedSegment = {
    key: keyFor(meetingId, index),
    meetingId,
    index,
    blob,
    createdAt: Date.now(),
  }
  await runTransaction('readwrite', (store) => store.put(entry))
}

/**
 * Drops a segment once its transcript is safely in the database. This is the
 * ONLY thing that should delete parked audio — never a UI action, never a
 * timeout, never "finalize ran". Until a transcript exists server-side, this
 * blob is the only copy of that part of the meeting.
 */
export async function releaseSegment(meetingId: string, index: number): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(keyFor(meetingId, index)))
}

/**
 * Everything still parked for one meeting, lowest segment index first. Used
 * on mount to resume work the previous page load didn't finish. Entries past
 * MAX_AGE_MS are swept here rather than by a separate scheduled job — this is
 * the only moment the store is read, so it is the natural place for it.
 */
export async function loadParkedSegments(meetingId: string): Promise<ParkedSegment[]> {
  const rows = await runTransaction<ParkedSegment[]>('readonly', (store) =>
    store.index(MEETING_INDEX).getAll(meetingId),
  )
  if (!rows) return []
  const cutoff = Date.now() - MAX_AGE_MS
  await Promise.all(
    rows.filter((row) => row.createdAt < cutoff).map((row) => releaseSegment(row.meetingId, row.index)),
  )
  return rows.filter((row) => row.createdAt >= cutoff).sort((a, b) => a.index - b.index)
}
