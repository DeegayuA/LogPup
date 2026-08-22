import { and, eq, or } from 'drizzle-orm'

import { db } from '@/db'
import { geminiKeys } from '@/db/schema'
import {
  FALLBACK_MODEL_CHOICES,
  type FeatureKind,
  type ModelChoice,
} from '@/features/gemini/ai-features'
import { buildModelCatalog, type RawGeminiModel } from '@/features/gemini/model-catalog'
import { orderKeysForRotation } from '@/features/gemini/rotation'
import { decryptSecret } from '@/lib/crypto'

/**
 * Asking Google what models exist, instead of somebody remembering to.
 *
 * The catalog was a hand-written array. Shipping a new model meant editing a
 * file; retiring one meant remembering to delete it, and forgetting meant
 * leaving a choice that fails permanently for whoever picked it. This asks
 * `GET /v1beta/models` instead, so a model that exists is offered and a model
 * that has been shut down is not — with no edit either way.
 *
 * SERVER ONLY, and the reason is the key. Discovery needs a real API key, and
 * a key must never reach a browser.
 *
 * There is no `server-only` package in this project to enforce that at build
 * time (see transcription/live-token.ts, which says the same). What enforces
 * it here is the `@/db` and `@/lib/crypto` imports below: a client component
 * that reached for this module would pull the database client and the
 * decryption key into a browser bundle and fail loudly long before shipping.
 * Do not remove those imports in favour of passing rows in — the coupling IS
 * the guard.
 *
 * WHAT THIS NEVER DOES:
 *  - return, log, or otherwise surface the key it used
 *  - fail a page. Every path below ends in a catalog: the discovered one when
 *    the call works, the static fallback when it does not. A settings page
 *    that cannot render its model picker because Google is having a bad
 *    morning is worse than a picker that is briefly a version behind.
 */

/**
 * Readonly on the way out: the fallback constant is `readonly` and a caller
 * must not be able to push a model into a catalog it did not fetch.
 */
export type ModelCatalog = Record<FeatureKind, readonly ModelChoice[]>

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * How long a fetched catalog is reused.
 *
 * Models arrive on the scale of months, so this is not a freshness problem —
 * it is a "do not spend a request from somebody's free-tier quota every time
 * they open Settings" problem. Fifteen minutes means a new model shows up
 * within one coffee break of anybody looking for it, and an idle workspace
 * costs nothing at all.
 */
export const MODEL_CATALOG_TTL_MS = 15 * 60 * 1000

/** How long to wait before deciding the catalog is not coming. */
const FETCH_TIMEOUT_MS = 5000

/**
 * Process-wide, not per-user. The model catalog is a property of Gemini, not
 * of whoever asked — two people opening Settings a minute apart should not
 * cost two requests.
 *
 * In memory on purpose: an instance that dies loses the entry and re-fetches,
 * which costs one request. Persisting it would mean a table, a migration, and
 * a second thing that can be stale.
 */
let cache: { at: number; catalog: ModelCatalog } | null = null

/**
 * An in-flight fetch, shared.
 *
 * Without this, ten people opening Settings in the same second make ten
 * identical requests — none of them has finished in time to populate the
 * cache for the others.
 */
let inFlight: Promise<ModelCatalog | null> | null = null

/** Test seam: drops the cache so one case is not answered by another. */
export function resetModelCatalogCache(): void {
  cache = null
  inFlight = null
}

/**
 * The catalog this workspace can actually call.
 *
 * `now` is a parameter so the TTL is testable without waiting fifteen minutes
 * and without this module reaching for the clock — the same discipline the
 * pure modules keep.
 */
export async function getModelCatalog(
  userId: string,
  now: number = Date.now(),
): Promise<ModelCatalog> {
  if (cache !== null && now - cache.at < MODEL_CATALOG_TTL_MS) return cache.catalog

  inFlight ??= fetchCatalog(userId).finally(() => {
    inFlight = null
  })

  const discovered = await inFlight
  if (discovered === null) {
    // No key, no network, or a response that made no sense. The static list
    // is stale by construction — that is why discovery exists — but it is a
    // working picker, and a working picker beats an empty one.
    return FALLBACK_MODEL_CHOICES
  }
  cache = { at: now, catalog: discovered }
  return discovered
}

/**
 * Is `model` something this workspace may be pinned to?
 *
 * The check the settings action needs, and it has to run against the
 * DISCOVERED catalog rather than the static one — otherwise the
 * newly-shipped model somebody just saw in the picker is rejected the moment
 * they choose it, which would make discovery worse than useless.
 */
export async function isSelectableModel(
  userId: string,
  kind: FeatureKind,
  model: string,
): Promise<boolean> {
  const catalog = await getModelCatalog(userId)
  return catalog[kind].some((choice) => choice.id === model)
}

/**
 * One pass over the API, or null if it could not be made to work.
 *
 * Returns null rather than throwing: every caller's answer to a failure is
 * the same (use the fallback), and an exception here would turn a Google
 * outage into a 500 on the Settings page.
 */
async function fetchCatalog(userId: string): Promise<ModelCatalog | null> {
  const key = await firstUsableKey(userId)
  if (key === null) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`${API_BASE}/models?pageSize=200`, {
        headers: { 'x-goog-api-key': key },
        signal: controller.signal,
        // Next would otherwise cache this fetch itself, on its own schedule,
        // in a layer that has never heard of MODEL_CATALOG_TTL_MS. One cache,
        // one rule.
        cache: 'no-store',
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) return null
    const body: unknown = await response.json()
    const models = readModels(body)
    if (models.length === 0) return null

    const catalog = buildModelCatalog(models)
    // A response that classifies to nothing at all is one we have misread — a
    // schema change, an error envelope, a project with no access. Falling back
    // is right; showing an empty picker is not.
    if (catalog.text.length === 0) return null
    return catalog
  } catch {
    // Aborted, offline, or invalid JSON. Same answer to all three.
    return null
  }
}

/** The `models` array, if the body really has one. */
function readModels(body: unknown): RawGeminiModel[] {
  if (typeof body !== 'object' || body === null) return []
  const models = (body as { models?: unknown }).models
  if (!Array.isArray(models)) return []
  return models.filter(
    (entry): entry is RawGeminiModel => typeof entry === 'object' && entry !== null,
  )
}

/**
 * One key to ask with — the caller's own first, then the shared pool, in the
 * same LRU order every other call uses.
 *
 * Listing models does not consume the generation quota, so this is the one
 * place a shared key can be spent without taking anything from its owner.
 *
 * A key that fails to decrypt is skipped rather than thrown on: one corrupt
 * row must not take the model picker down for everybody.
 */
async function firstUsableKey(userId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(geminiKeys)
    .where(
      and(
        eq(geminiKeys.active, true),
        or(eq(geminiKeys.userId, userId), eq(geminiKeys.shared, true)),
      ),
    )
  for (const row of orderKeysForRotation(userId, rows)) {
    try {
      return decryptSecret(row.encryptedKey)
    } catch {
      continue
    }
  }
  return null
}
