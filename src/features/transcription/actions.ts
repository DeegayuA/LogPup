'use server'

import { z } from 'zod'
import { type ActionResult, err, ok } from '@/lib/action-result'
import { GeminiError } from '@/features/gemini/client'
import { resolveChain } from '@/features/gemini/model-choice'
import { aiFeatureDisabledMessage, getAiPrefs } from '@/features/gemini/prefs'
import { canManageMeeting } from '@/features/meetings/ai-actions'
import { isLiveTranscriptionEnabled } from './flag'
import { type MintedLiveToken, mintLiveToken } from './live-token'

const requestTokenInput = z.object({ meetingId: z.uuid() })

export type LiveTokenResult = MintedLiveToken

/**
 * Issues a short-lived Gemini Live token for a meeting the caller may record.
 *
 * Called once per WebSocket connection, not once per recording: tokens are
 * single-use, and a long meeting reconnects roughly every 10 minutes when the
 * Live socket hits its lifetime cap.
 *
 * Gated three ways before any key is decrypted — flag, authentication, and the
 * same `canManageMeeting` check every other recording action uses — so this
 * cannot become a way to spend another user's Gemini quota.
 */
export async function requestLiveToken(meetingId: string): Promise<ActionResult<LiveTokenResult>> {
  if (!isLiveTranscriptionEnabled()) {
    return err('Live transcription is not enabled.')
  }

  const parsed = requestTokenInput.safeParse({ meetingId })
  if (!parsed.success) return err('Invalid meeting.')

  const allowed = await canManageMeeting(parsed.data.meetingId)
  if (!allowed) return err('Not allowed to record this meeting.')

  const disabled = await aiFeatureDisabledMessage(allowed.session.user.id, 'live-captions')
  if (disabled) return err(disabled)

  try {
    const prefs = await getAiPrefs(allowed.session.user.id)
    const minted = await mintLiveToken(allowed.session.user.id, {
      models: resolveChain('live-captions', prefs['live-captions'].model),
    })
    return ok(minted)
  } catch (error) {
    // GeminiError messages are written to be shown to the user and already say
    // "recording continues" — the live path failing must never read as though
    // the recording itself is in danger.
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not start live transcription — recording continues without it.')
  }
}
