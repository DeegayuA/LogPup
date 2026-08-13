// Phone numbers are stored as typed (people recognize their own formatting)
// and normalized only for `tel:` links, which must not contain spaces,
// dashes or parentheses.

/** Digits (and a single leading +) for use in a `tel:` href. */
export function telHref(phone: string): string {
  const trimmed = phone.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  return `tel:${plus}${trimmed.replace(/\D/g, '')}`
}

/**
 * Accepts the shapes people actually type — "+94 71 234 5678",
 * "071-234-5678", "(071) 2345678" — and rejects anything without a
 * plausible number of digits. Returns the tidied display form, or null
 * when the input can't be a phone number.
 */
export function normalizePhone(input: string): string | null {
  const display = input.trim().replace(/\s+/g, ' ')
  if (display === '') return null
  if (!/^\+?[\d\s()./-]+$/.test(display)) return null
  const digits = display.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return display
}

/**
 * WhatsApp deep link. wa.me wants international digits with NO plus and no
 * leading zeros — a Sri Lankan "071 234 5678" must become 94712345678, so a
 * local number (leading 0, no country code) has the 0 swapped for 94. A
 * number typed with +country-code is used as its digits.
 *
 * `message` prefills the chat (the "automated" send); without it WhatsApp
 * opens an empty conversation (the manual one). Either way nothing sends
 * until the person presses send — this app never messages on its own.
 */
export function waHref(phone: string, message?: string): string {
  const digits = phone.trim().replace(/\D/g, '')
  const international =
    phone.trim().startsWith('+') || !digits.startsWith('0')
      ? digits
      : `94${digits.replace(/^0+/, '')}`
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : ''
  return `https://wa.me/${international}${text}`
}
