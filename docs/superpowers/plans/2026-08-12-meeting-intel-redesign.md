# Meeting Intel Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the meeting intel panel into a tiered card rail (Act / Read / Reference) so a team member finds "what do I need to do / know" in under ten seconds.

**Architecture:** Pure render-layer restructure of `meeting-intel.tsx`'s notes sections plus two small shared components (`IntelCard`, attribution chips). No schema, action, or data-flow changes. Spec: `docs/superpowers/specs/2026-08-12-meeting-intel-redesign-design.md`.

**Tech Stack:** Next.js 16 / React 19, Tailwind tokens ("watchdog calm"), Base UI–flavored shadcn primitives (`render={<.../>}` — never `asChild`), lucide-react, vitest.

## Global Constraints

- **Base branch:** the post-landing integration result (integration/2026-08-11 merged with main). NOT pre-merge main — `meeting-intel.tsx` locations in this plan are anchors (quoted heading text), not line numbers; locate by search.
- Tokens only — a raw hex/oklch value in a component is a defect.
- No new hues. Ember (`chart-1` family / ring treatment) appears ONLY on Carried forward.
- Sinhala text: `lang="si"`, `text-foreground` (never muted), `leading-relaxed`.
- Headings: the page owns the h1 and the panel an h2; every card title is an `<h3 className="font-heading text-sm font-semibold">`.
- Counts/data values: Geist Mono `font-mono tabular-nums`.
- No `transition: all`; named properties, 120–250ms.
- All existing vitest suites stay green; `npx tsc --noEmit` clean after every task.
- Do not touch: transcription pipeline, note-timeline internals beyond the chip extraction in Task 2, RSVP/detail dialog, schema, server actions.

---

### Task 1: `IntelCard` shared section shell

**Files:**
- Create: `src/features/meetings/components/intel-card.tsx`
- Test: `src/features/meetings/components/intel-card.test.tsx`

**Interfaces:**
- Produces: `IntelCard({ icon: LucideIcon, title: string, count?: number, countNoun?: string, accent?: 'act' | 'ember', collapsible?: boolean, defaultOpen?: boolean, children })` — every later task wraps its section in this.
- Produces: `CountChip({ value: number })` — mono chip, `aria-hidden` (the count is spoken via the heading's aria-label).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/meetings/components/intel-card.test.tsx
import { render, screen } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { IntelCard } from '@/features/meetings/components/intel-card'

test('heading speaks the count, chip is hidden from the tree', () => {
  render(
    <IntelCard icon={BookOpen} title="Glossary" count={3} countNoun="terms">
      <p>body</p>
    </IntelCard>,
  )
  expect(screen.getByRole('heading', { level: 3, name: 'Glossary, 3 terms' })).toBeInTheDocument()
  expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true')
})

test('collapsible renders a real disclosure', () => {
  render(
    <IntelCard icon={BookOpen} title="Glossary" count={3} countNoun="terms" collapsible>
      <p>body</p>
    </IntelCard>,
  )
  expect(screen.getByRole('button', { name: /glossary/i })).toHaveAttribute('aria-expanded', 'false')
})
```

If `@testing-library/react` is not already a devDependency, check how existing component tests in the repo render (grep `@testing-library` in `src/`); if none exists, test the pure parts (spoken-label construction) as a plain function instead — do NOT add a heavyweight test harness for one task.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/meetings/components/intel-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/features/meetings/components/intel-card.tsx
'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CountChip({ value }: { value: number }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground"
    >
      {value}
    </span>
  )
}

/**
 * Section shell for the intel rail. `accent='act'` draws the pine act-tier
 * bar; `accent='ember'` is reserved for Carried forward (the only amber on
 * the panel — spec "Avoided defaults"). `collapsible` renders a true
 * disclosure (aria-expanded), used by Glossary.
 */
export function IntelCard({
  icon: Icon,
  title,
  count,
  countNoun,
  accent,
  collapsible = false,
  defaultOpen = false,
  children,
}: {
  icon: LucideIcon
  title: string
  count?: number
  countNoun?: string
  accent?: 'act' | 'ember'
  collapsible?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const spoken = count !== undefined ? `${title}, ${count} ${countNoun ?? 'entries'}` : title
  const body = !collapsible || open ? <div className="flex flex-col gap-2 p-3 pt-0">{children}</div> : null

  const header = (
    <span className="flex w-full items-center gap-2 p-3">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <h3 aria-label={spoken} className="font-heading text-sm font-semibold">
        {title}
      </h3>
      {count !== undefined ? <CountChip value={count} /> : null}
      {collapsible ? (
        <ChevronDown
          aria-hidden
          className={cn(
            'ml-auto size-4 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      ) : null}
    </span>
  )

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10',
        accent === 'act' && 'border-l-2 border-primary',
        accent === 'ember' && 'ring-chart-1/40',
      )}
    >
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="w-full text-left outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {header}
        </button>
      ) : (
        header
      )}
      {body}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/meetings/components/intel-card.test.tsx` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/components/intel-card.tsx src/features/meetings/components/intel-card.test.tsx
git commit -m "feat: IntelCard section shell for the intel rail"
```

---

### Task 2: shared attribution chips (extract from note-timeline)

**Files:**
- Create: `src/features/meetings/components/attribution-chips.tsx`
- Modify: `src/features/meetings/components/note-timeline.tsx` (replace its inline unresolved-label chip markup with the import; search anchor: the mono chip rendering added by the attribution work — grep `font-mono` near `speakerLabel`)
- Test: `src/features/meetings/components/attribution-chips.test.tsx`

**Interfaces:**
- Produces: `PersonChip({ name: string, avatarUrl?: string | null })` — resolved person: avatar dot + name, body weight.
- Produces: `LabelChip({ label: string })` — unconfirmed speaker label: mono chip, visually distinct from a person. Never used for a resolved person.

- [ ] **Step 1: Write the failing test** (same harness decision as Task 1 Step 1)

```tsx
// src/features/meetings/components/attribution-chips.test.tsx
import { render, screen } from '@testing-library/react'
import { LabelChip, PersonChip } from '@/features/meetings/components/attribution-chips'

test('LabelChip renders mono, marked as an unconfirmed label', () => {
  render(<LabelChip label="Speaker 1" />)
  const chip = screen.getByText('Speaker 1')
  expect(chip.className).toContain('font-mono')
  expect(screen.getByText('unconfirmed', { exact: false })).toBeInTheDocument()
})

test('PersonChip renders the name in body weight, no mono', () => {
  render(<PersonChip name="Shanika Ayasmanthi" />)
  expect(screen.getByText('Shanika Ayasmanthi').className).not.toContain('font-mono')
})
```

- [ ] **Step 2: Run to verify FAIL** (`module not found`)

- [ ] **Step 3: Implement**

```tsx
// src/features/meetings/components/attribution-chips.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/** Resolved person: a human confirmed this attribution. */
export function PersonChip({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <Avatar size="sm" className="size-4 shrink-0">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-2xs">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      {name}
    </span>
  )
}

/** Unconfirmed label straight from the model — a label, never a person. */
export function LabelChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      {label}
      <span className="sr-only">, unconfirmed speaker label</span>
    </span>
  )
}
```

- [ ] **Step 4: Replace note-timeline's inline chip markup with these imports.** Behaviour identical; only the source of the markup moves. Run: `npx vitest run src/features/meetings` → green.

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/components/attribution-chips.tsx src/features/meetings/components/attribution-chips.test.tsx src/features/meetings/components/note-timeline.tsx
git commit -m "feat: shared PersonChip/LabelChip attribution components"
```

---

### Task 3: Summary card — EN + SI siblings, provenance footer

**Files:**
- Modify: `src/features/meetings/components/meeting-intel.tsx` — the AI summary render block. Anchors: heading text `Decisions made`, `Discussion highlights`, `Next steps`, the Sinhala header `සිංහල සාරාංශය`, and the provenance line `Written up by AI`.

**Interfaces:**
- Consumes: `IntelCard` (Task 1). Decisions and Next steps move OUT of this card in Task 4 — this task only rebuilds Summary (highlights EN + SI) and the footer.

- [ ] **Step 1: Wrap the summary in an IntelCard and make SI an equal sibling**

```tsx
<IntelCard icon={Sparkles} title="Summary">
  <div className="flex flex-col gap-3">
    <div>
      <h4 className="text-xs font-medium text-muted-foreground">Discussion highlights</h4>
      <ul className="mt-1 flex flex-col gap-1 text-sm">{/* existing EN bullets */}</ul>
    </div>
    <div lang="si">
      <h4 className="text-xs font-medium text-muted-foreground">
        සිංහල සාරාංශය <span lang="en">(Sinhala summary)</span>
      </h4>
      <ul className="mt-1 flex flex-col gap-1 text-sm leading-relaxed text-foreground">
        {/* existing SI bullets — full foreground, relaxed leading */}
      </ul>
    </div>
  </div>
  <footer className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-2xs text-muted-foreground/80">
    <span className="inline-flex items-center gap-1">
      <Sparkles aria-hidden className="size-3" /> AI write-up
    </span>
    <time className="font-mono tabular-nums">{/* existing timestamp value */}</time>
    <span className="font-mono">{/* existing model name */}</span>
    <span>AI wrote this — check before acting on it.</span>
  </footer>
</IntelCard>
```

Keep the existing data plumbing untouched — this is markup-only. `Sparkles` is likely already imported; if not, add from `lucide-react`. Keep the file's own variable names for the bullet arrays — the anchors identify them.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; dev-render the page and confirm SI text is full-contrast and diacritics don't clip.

- [ ] **Step 3: Commit** — `git commit -m "feat: summary card with equal-citizen Sinhala and provenance footer"`

---

### Task 4: Act tier — Decisions, Next steps, Carried forward

**Files:**
- Modify: `src/features/meetings/components/meeting-intel.tsx`. Anchors: `Decisions made` bullets, `Next steps` bullets, the carried-forward block (anchors: `Carried forward`, the `Resolve` / `Not yet` / `Why` / `What they said` buttons).

**Interfaces:**
- Consumes: `IntelCard` with `accent='act'` and `accent='ember'`.

- [ ] **Step 1: Move Decisions and Next steps into their own act-tier cards, ABOVE Summary in the rail**

```tsx
<IntelCard icon={Landmark} title="Decisions" count={decisions.length} countNoun="decisions" accent="act">
  <ul className="flex flex-col gap-1.5 text-sm">{/* existing decision items */}</ul>
</IntelCard>

<IntelCard icon={ListChecks} title="Next steps" count={nextSteps.length} countNoun="steps" accent="act">
  <ul className="flex flex-col gap-1.5">
    {/* each existing item becomes a row: */}
    <li className="flex items-start gap-2 text-sm">
      <ChevronRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
      {/* existing item text */}
    </li>
  </ul>
</IntelCard>
```

(`Landmark`, `ListChecks`, `ChevronRight` from `lucide-react`; reuse existing imports where present. Keep the file's own local names for the data arrays.)

- [ ] **Step 2: Carried forward — ember card, one primary action**

Wrap the block in `<IntelCard icon={Clock} title="Carried forward" count={items.length} countNoun="open items" accent="ember">`. Change the four equal buttons so `Resolve` uses the default (primary) `Button` variant and `Not yet`, `Why`, `What they said` use `variant="ghost"`. Do not change any handler.

- [ ] **Step 3: Verify** — tsc clean; `npx vitest run src/features/meetings` green (handlers untouched); visual check that ember appears nowhere else on the panel.

- [ ] **Step 4: Commit** — `git commit -m "feat: act-tier cards — decisions, next steps, primary resolve"`

---

### Task 5: Read + Reference tiers — Discussion, For next meeting, Glossary

**Files:**
- Modify: `src/features/meetings/components/meeting-intel.tsx`. Anchors: `By person` heading, `For next meeting` heading, `Terms` heading, the `SpeakerAssignmentPanel` mount.

**Interfaces:**
- Consumes: `IntelCard`, `PersonChip`, `LabelChip`, existing `SpeakerAssignmentPanel`.

- [ ] **Step 1: Discussion card.** Rename visible title from `By person` to `Discussion`, wrap in `<IntelCard icon={Users} title="Discussion" count={perPerson.length} countNoun="speakers">`. Move the existing `<SpeakerAssignmentPanel …>` mount to the top of this card's body. Replace ALL-CAPS speaker name headings: resolved → `<PersonChip name={…} avatarUrl={…} />`, unresolved → `<LabelChip label={…} />`.

- [ ] **Step 2: For next meeting card.** Same chip treatment, `<IntelCard icon={CircleHelp} title="For next meeting" count={…} countNoun="questions">`.

- [ ] **Step 3: Glossary.** `<IntelCard icon={BookOpen} title="Glossary" count={terms.length} countNoun="terms" collapsible>`. Each term: term text in `text-sm font-medium`; definitions stacked below — SI definition first with `lang="si"` full-foreground `leading-relaxed`, EN second in `text-muted-foreground`.

- [ ] **Step 4: Rail order.** Final DOM order of the notes area: Decisions → Next steps → Carried forward → Summary → Discussion → For next meeting → Glossary.

- [ ] **Step 5: Verify + commit** — tsc clean, meetings suite green. `git commit -m "feat: read and reference tiers — discussion chips, collapsible glossary"`

---

### Task 6: States + final verification

**Files:**
- Modify: `src/features/meetings/components/meeting-intel.tsx` — the loading / empty / error branches around the notes render (anchors: the existing loading state and the notes-absent branch).

- [ ] **Step 1: Loading skeleton matching the rail** — three ghost cards, not a spinner:

```tsx
<div aria-hidden className="flex flex-col gap-3">
  {[0, 1, 2].map((i) => (
    <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" />
  ))}
</div>
<span className="sr-only" role="status">Writing up the meeting…</span>
```

- [ ] **Step 2: Empty state with next action** — "No notes yet. Record or upload audio and LogPup writes them up." plus the existing record affordance.

- [ ] **Step 3: Error state** — render the server action's returned error message verbatim (the `GeminiError` messages are already humanized and name the failure — NO_KEYS points at Profile, TRANSIENT_BUSY says the recording is safe) plus the existing retry affordance. No generic fallback when a message exists.

- [ ] **Step 4: Full verify**

Run: `npx tsc --noEmit` · `npx vitest run` (all suites) · `npx eslint src/features/meetings src/components` — counts at or below the branch baseline. Browser pass: heading order (h2 → h3s), keyboard through glossary disclosure and carried-forward actions, `lang="si"` present on every Sinhala block, ember only on Carried forward.

- [ ] **Step 5: Commit** — `git commit -m "feat: intel rail states — skeleton, empty, honest errors"`

---

## Self-review notes

- Spec coverage: tiers (T4/T5), chips (T2/T5), Sinhala (T3/T5), provenance (T3), Resolve primary (T4), states (T6); a11y items distributed per task. Out-of-scope list respected — no server/action changes anywhere.
- Anchors used instead of line numbers throughout because the base is the post-merge file.
- Data-array local names deliberately deferred to the file's own names — the anchors (visible heading strings) identify each block unambiguously.
