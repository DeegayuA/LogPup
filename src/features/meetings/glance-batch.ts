// Chunking wrapper around the getMeetingGlances server action. The action
// caps a single call at MAX_GLANCE_IDS and silently answers null for every
// id past the cap (with only a server-side warn) — so a workspace with 100+
// not-yet-ended meetings would paint its overflow rows chip-less forever.
// This wrapper splits any larger request into cap-sized calls and merges the
// maps, keeping the action's own fixed-statement-count contract per call.
//
// No 'use server'/'use client' directive on purpose: the page (server)
// invokes it directly, and the client glance store imports it for retry and
// the supplemental paged-row fetches — both sides get the same behaviour.

import { getMeetingGlances } from '@/features/meetings/glance-actions'
import { MAX_GLANCE_IDS } from '@/features/meetings/glance-core'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'

export type GlanceBatchResult =
  | { ok: true; map: Record<string, MeetingGlance | null> }
  | { ok: false }

/**
 * getMeetingGlances over any number of ids: one call when it fits under the
 * cap, parallel cap-sized calls merged into one map otherwise. Any failed
 * chunk fails the whole batch — the caller has ONE error surface (the
 * list-level notice), and a half-answered map would make some rows lie.
 */
export async function getMeetingGlancesChunked(
  meetingIds: string[],
): Promise<GlanceBatchResult> {
  const ids = [...new Set(meetingIds)]
  if (ids.length <= MAX_GLANCE_IDS) return getMeetingGlances(ids)

  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += MAX_GLANCE_IDS) {
    chunks.push(ids.slice(i, i + MAX_GLANCE_IDS))
  }
  const results = await Promise.all(chunks.map((chunk) => getMeetingGlances(chunk)))

  const map: Record<string, MeetingGlance | null> = {}
  for (const result of results) {
    if (!result.ok) return { ok: false }
    Object.assign(map, result.map)
  }
  return { ok: true, map }
}
