export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false
      error: string
      /**
       * A machine-readable name for WHY this failed, when the caller has one
       * worth branching on — currently the GeminiErrorCode behind an AI
       * failure, so the UI can offer "check your keys" for a rejected key and
       * not for a malformed response.
       *
       * Optional and absent by default. The alternative was for the UI to
       * recognise a failure by matching its English message, which breaks the
       * moment somebody rewords a sentence — and these sentences are already
       * written two ways (a personal key versus a shared team pool).
       */
      code?: string
    }

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data })
/**
 * `code` is optional so every existing `err('...')` call is unchanged — this
 * is the helper all 61 action modules funnel through, and a required second
 * argument would have been a repo-wide edit to add one link to one card.
 */
export const err = (error: string, code?: string): ActionResult<never> =>
  code === undefined ? { ok: false, error } : { ok: false, error, code }
