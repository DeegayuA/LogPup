import { isValidElement, type ReactElement } from 'react'

/**
 * Decide Base UI's `nativeButton` for a `render` prop.
 *
 * Base UI defaults `nativeButton` to true and, in dev, warns from a
 * useEffect whenever the element that actually rendered is not a <button>
 * (see @base-ui/react/internals/use-button/useButton.js). Every
 * `<Button render={<Link … />}>` in this repo — dozens of them — rendered an
 * <a> through that default, so each page load logged one warning per link
 * and, more importantly, Base UI merged `type="button"` onto an anchor and
 * skipped the keyboard handling it applies to non-native buttons.
 *
 * Inferred here, once, rather than typed at every call site: the element
 * type is right there in the prop. A <button> element (or nothing) keeps the
 * native path; any other element — a plain 'a', a 'span', or a component such
 * as next/link — takes the non-native one. A render FUNCTION cannot be
 * inspected before it runs, so it keeps Base UI's default. An explicit prop
 * always wins, so a caller who knows better can still say so.
 */
export function inferNativeButton(
  render: ReactElement | ((...args: never[]) => ReactElement) | undefined,
  explicit: boolean | undefined,
): boolean {
  if (explicit !== undefined) return explicit
  if (render === undefined || typeof render === 'function') return true
  if (!isValidElement(render)) return true
  return render.type === 'button'
}
