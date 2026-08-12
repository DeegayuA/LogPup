/**
 * Shared long-form styling for the legal pages. Written as descendant
 * variants rather than per-element classes because /privacy and /terms are
 * mostly plain prose — tagging every <p> and <li> individually would bury the
 * text those pages exist to make readable.
 *
 * Deliberately not the Tailwind typography plugin: it isn't installed, and
 * pulling it in for two pages would fight the "watchdog calm" token set.
 */
export const LEGAL_PROSE = [
  'text-sm leading-relaxed text-muted-foreground',
  '[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-bold [&_h3]:tracking-tight [&_h3]:text-foreground',
  '[&_p]:mb-3',
  '[&_ul]:mb-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5',
  '[&_li]:list-disc [&_li]:marker:text-primary',
  '[&_strong]:font-medium [&_strong]:text-foreground',
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
  '[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left',
  '[&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-foreground',
  '[&_td]:border-b [&_td]:border-border [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top',
].join(' ')
