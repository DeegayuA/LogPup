import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import { decryptSecret } from '@/lib/crypto'

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type GeminiErrorCode = 'NO_KEYS' | 'ALL_KEYS_FAILED' | 'BAD_RESPONSE'

export class GeminiError extends Error {
  code: GeminiErrorCode
  constructor(code: GeminiErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

export async function hasGeminiKeys(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: geminiKeys.id })
    .from(geminiKeys)
    .where(and(eq(geminiKeys.userId, userId), eq(geminiKeys.active, true)))
    .limit(1)
  return Boolean(row)
}

/** Cheap credential check — lists one model, costs no tokens. */
export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/models?pageSize=1`, {
      headers: { 'X-goog-api-key': apiKey },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Calls generateContent with the user's own keys, rolling across active keys
 * least-recently-used first so free-tier rate limits spread out. A key that
 * answers 429/401/403 gets its failCount bumped and the next key is tried.
 */
export async function callGemini(
  userId: string,
  parts: GeminiPart[],
  opts?: { model?: string; responseJson?: boolean },
): Promise<string> {
  const model = opts?.model ?? DEFAULT_GEMINI_MODEL
  const keys = await db
    .select()
    .from(geminiKeys)
    .where(and(eq(geminiKeys.userId, userId), eq(geminiKeys.active, true)))
    .orderBy(sql`${geminiKeys.lastUsedAt} ASC NULLS FIRST`)

  if (keys.length === 0) {
    throw new GeminiError('NO_KEYS', 'No active Gemini API keys — add one in Profile.')
  }

  let lastFailure = ''
  for (const key of keys) {
    let apiKey: string
    try {
      apiKey = decryptSecret(key.encryptedKey)
    } catch {
      lastFailure = `Key "${key.label}" could not be decrypted`
      continue
    }

    const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        ...(opts?.responseJson
          ? { generationConfig: { responseMimeType: 'application/json' } }
          : {}),
      }),
    })

    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
      await db
        .update(geminiKeys)
        .set({ lastUsedAt: new Date(), failCount: 0 })
        .where(eq(geminiKeys.id, key.id))
      if (!text) throw new GeminiError('BAD_RESPONSE', 'Gemini returned an empty response')
      return text
    }

    // Rate-limited or unauthorized — mark and roll to the next key.
    if (res.status === 429 || res.status === 401 || res.status === 403) {
      lastFailure = `Key "${key.label}" got HTTP ${res.status}`
      await db
        .update(geminiKeys)
        .set({ failCount: sql`${geminiKeys.failCount} + 1`, lastUsedAt: new Date() })
        .where(eq(geminiKeys.id, key.id))
      continue
    }

    const body = await res.text().catch(() => '')
    throw new GeminiError('BAD_RESPONSE', `Gemini error ${res.status}: ${body.slice(0, 300)}`)
  }

  throw new GeminiError(
    'ALL_KEYS_FAILED',
    `All Gemini keys are rate-limited or invalid (${lastFailure}). Add another key or wait a minute.`,
  )
}
