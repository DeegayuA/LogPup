'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { navItems } from '@/components/shell/nav-items'

/**
 * Every keyboard shortcut in one place, opened by pressing "?" anywhere in
 * the app shell (the handler lives beside the g-jump machine in
 * features/search/components/command-center.tsx) or from the palette's
 * first-run teach row.
 *
 * The jump rows are DERIVED from nav-items.ts, never copied: the letter a
 * sidebar row advertises, the letter the g-handler answers to, and the
 * letter this table teaches are all the same `key` field, so a nav change
 * updates all three together.
 */

/** One key-column + description row. Keys are chips, descriptions are prose. */
function ShortcutRow({ keys, children }: { keys: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr>
      <td className="w-24 py-1.5 pr-4 align-top whitespace-nowrap">{keys}</td>
      <td className="py-1.5 align-top text-muted-foreground">{children}</td>
    </tr>
  )
}

export function ShortcutsOverlay({
  open,
  onOpenChange,
  goShortcutsOn,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /* Threaded from the same switch that gates the g-key handler and its kbd
     chips (WCAG 2.1.4 opt-out): this table must never teach a jump that a
     keypress would not perform. */
  goShortcutsOn: boolean
}) {
  const [isMac, setIsMac] = React.useState(true)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe platform detection
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.userAgent))
  }, [])

  const jumps = navItems.filter(
    (item): item is (typeof navItems)[number] & { key: string } => Boolean(item.key),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Everything the keyboard can do here, in one place.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Everywhere
          </h2>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <ShortcutRow
                keys={
                  isMac ? (
                    <Kbd>⌘K</Kbd>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Kbd>Ctrl</Kbd>
                      <Kbd>K</Kbd>
                    </span>
                  )
                }
              >
                Open the command center — search, create, run commands
              </ShortcutRow>
              <ShortcutRow keys={<Kbd>?</Kbd>}>Show or hide this list</ShortcutRow>
              <ShortcutRow keys={<Kbd>Esc</Kbd>}>Close the open dialog or menu</ShortcutRow>
            </tbody>
          </table>
        </section>

        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Jump to a page
          </h2>
          {goShortcutsOn ? (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {jumps.map((item) => (
                  <ShortcutRow
                    key={item.href}
                    keys={
                      <span className="inline-flex items-center gap-1">
                        <Kbd>g</Kbd>
                        <Kbd>{item.key}</Kbd>
                      </span>
                    }
                  >
                    {item.label}
                  </ShortcutRow>
                ))}
              </tbody>
            </table>
          ) : (
            /* The opt-out wins: teaching a jump that the handler will ignore
               would be a lie. The palette's Commands group holds the toggle. */
            <p className="text-sm text-muted-foreground">
              Go-to jumps are turned off in this browser. Re-enable them from the command
              center&rsquo;s Commands group.
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
