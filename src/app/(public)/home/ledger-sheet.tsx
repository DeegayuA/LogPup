/**
 * The masthead artefact: a ruled sheet with the day's work written onto it,
 * and the last line still open.
 *
 * WHY A DRAWN OBJECT AND NOT A SCREENSHOT. This page is served with no
 * session, so a screenshot of the running product would publish real staff
 * names, real allocations and real meeting content as marketing — the same
 * reason plates.tsx reconstructs its three panels from primitives instead of
 * capturing them. Drawn as inline SVG rather than shipped as an asset so every
 * stroke is `currentColor` and the sheet re-inks itself for light and dark
 * instead of carrying two files.
 *
 * WHAT IT SAYS. The page's argument is that LogPup is a record rather than a
 * dashboard: the ruled page is already there, and the only thing that happens
 * is that somebody writes on it. So the rules are drawn first and the ink
 * lands second, at uneven lengths because entries are uneven, and the bottom
 * line stays blank with a caret on it — a log records what happened, so the
 * current day is not written until it is over. The same sentence as the
 * fortnight strip further down the page, told at masthead scale.
 *
 * NO LAYOUT SHIFT, AND NEVER THE LCP. The viewBox fixes the aspect and the
 * height comes from the class, so the box is reserved before paint. It is
 * `aria-hidden` because the fortnight strip below carries this idea with real
 * semantics, and a decorative duplicate would make a screen reader read the
 * same argument twice.
 */

/** Ruled lines. Even spacing — this is stationery, not data. */
const RULES = Array.from({ length: 9 }, (_, index) => 38 + index * 34)

/**
 * Ink. `start` and `width` are fractions of the usable line. The values are
 * deliberately irregular: a set of equal bars reads as a chart, and this has
 * to read as handwriting seen from across a room. The last ruled line carries
 * no entry at all — that gap is the point of the drawing.
 */
const ENTRIES = [
  { line: 0, start: 0.06, width: 0.62 },
  { line: 1, start: 0.06, width: 0.41 },
  { line: 2, start: 0.06, width: 0.78 },
  { line: 3, start: 0.06, width: 0.29 },
  { line: 4, start: 0.06, width: 0.66 },
  { line: 5, start: 0.06, width: 0.52 },
  { line: 6, start: 0.06, width: 0.71 },
  { line: 7, start: 0.06, width: 0.34 },
] as const

const WIDTH = 520
const INSET = 18
const USABLE = WIDTH - INSET * 2

export function LedgerSheet() {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} 340`}
      className="h-auto w-full max-w-[32rem] text-foreground"
      fill="none"
    >
      {/* The rules first: hairlines at the border tone, the page before
          anything is written on it. */}
      {RULES.map((y, index) => (
        <line
          key={`rule-${y}`}
          x1={INSET}
          y1={y}
          x2={WIDTH - INSET}
          y2={y}
          stroke="currentColor"
          strokeWidth={1}
          className="text-border motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 motion-safe:[animation-fill-mode:backwards]"
          style={{ animationDelay: `${index * 45}ms` }}
        />
      ))}

      {/* The ink, landing after the rules it sits on. Each entry is one thick
          stroke rather than lettering: legible as writing at a glance, and it
          cannot accidentally spell anything in a language this studio works
          in. */}
      {ENTRIES.map((entry) => (
        <line
          key={`ink-${entry.line}`}
          x1={INSET + USABLE * entry.start}
          y1={RULES[entry.line] - 7}
          x2={INSET + USABLE * (entry.start + entry.width)}
          y2={RULES[entry.line] - 7}
          stroke="currentColor"
          strokeWidth={7}
          strokeLinecap="round"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-500 motion-safe:[animation-fill-mode:backwards]"
          /* Staggered behind the rules, so the page is ruled before it is
             written on, and one entry at a time rather than eight at once —
             the sequence is the idea. */
          style={{ animationDelay: `${420 + entry.line * 90}ms` }}
        />
      ))}

      {/* The open line: a caret at the start of the last rule, arriving after
          the final entry and never blinking. A blink would claim something is
          waiting for input; this is a record whose next line is simply not
          written yet. */}
      <line
        x1={INSET + USABLE * 0.06}
        y1={RULES[8] - 16}
        x2={INSET + USABLE * 0.06}
        y2={RULES[8] - 2}
        stroke="currentColor"
        strokeWidth={2}
        className="text-primary motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:[animation-fill-mode:backwards]"
        style={{ animationDelay: '1180ms' }}
      />
    </svg>
  )
}
