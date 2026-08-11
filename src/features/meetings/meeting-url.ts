import { z } from 'zod'

/**
 * A meeting's video-call link ends up as the `href` of a Join button, so the
 * scheme is a security boundary rather than a formatting preference. A bare
 * `z.url()` is not enough: `javascript:alert(1)` and `data:text/html,…` are
 * both well-formed URLs and both pass it, and both execute when clicked.
 * Pinning the protocol is what makes the stored value safe to render.
 */
const HTTP_URL = z.url({ protocol: /^https?$/ })

export const MEETING_URL_ERROR = 'Enter a link starting with http:// or https://'

/**
 * Trims first, and maps a blank field to `null` so clearing the input actually
 * clears the column instead of storing an empty string.
 */
export const meetingUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || HTTP_URL.safeParse(value).success, {
    error: MEETING_URL_ERROR,
  })
  .transform((value) => (value === '' ? null : value))

/**
 * The client-side mirror of the same rule, for feedback before the round-trip.
 * Blank counts as valid — the link is optional; the server stays authoritative.
 */
export function isValidMeetingUrl(value: string): boolean {
  return meetingUrlSchema.safeParse(value).success
}
