/**
 * Has the app hydrated yet — asked as a module flag, not as component state.
 *
 * THE PROBLEM THIS SOLVES. A `motion` component with `initial="hidden"`
 * renders that hidden state on the SERVER: the HTML ships with
 * `style="opacity:0"` and the content only becomes visible once the bundle
 * has loaded, hydrated and run the entrance. On a fast connection that gap is
 * a couple of hundred milliseconds; on a slow one it is a page that looks
 * empty, and if the bundle fails outright it is a page that stays empty. This
 * codebase already refused that trade once — see the note above the
 * `[data-motion="on"]` block in globals.css, where the public page's reveals
 * are inverted precisely so nothing is hidden before JS runs.
 *
 * So the same rule applies here: THE SERVER'S OUTPUT IS THE VISIBLE STATE.
 * Anything present at first paint is simply there, unanimated; only things
 * that mount AFTER hydration — a Suspense zone that finishes streaming, a row
 * somebody just added, the next route — have an arrival to animate. Which is
 * also the more honest reading of the animation: it means "this is new", and
 * content that was in the first response is not new.
 *
 * WHY A MODULE FLAG AND NOT `useState` + `useEffect`. That pattern answers
 * "have *I* mounted", and every component answers false on its own first
 * render — including one mounted ten seconds after hydration, which is
 * exactly the case that should animate. This flag is set once, by the
 * provider, and read synchronously during render by everything after it.
 *
 * Reading a mutable module value during render is impure in the strict sense.
 * It is safe here because the value is monotonic — it goes false to true once
 * per document and never back — and because the only thing it decides is
 * whether an animation plays. A component that reads it early gets the
 * visible state, which is the correct answer for that moment.
 */
let hydrated = false

/** Called once, from MotionProvider's mount effect. */
export function markHydrated() {
  hydrated = true
}

/** True once the first client render has committed. */
export function isHydrated() {
  return hydrated
}
