'use client'

import { useSyncExternalStore } from 'react'
import {
  DEFAULT_SIDEBAR_STATE,
  SIDEBAR_STORAGE_KEY,
  nextSidebarState,
  resolveSidebarState,
  type SidebarState,
} from './sidebar-model'

/**
 * Whether this browser wants the sidebar wide or as a rail — localStorage read
 * as an external store rather than hydrated into state from an effect.
 *
 * WHY useSyncExternalStore AND NOT useState: the sidebar is server-rendered on
 * every authed page, and localStorage does not exist there. Seeding
 * `useState(() => localStorage.getItem(...))` makes the client's first render
 * disagree with the HTML the server just sent, which is the hydration mismatch
 * this file exists to avoid; hydrating it from an effect instead trades the
 * mismatch for a setState cascade on every page load. This is React's own
 * contract for an external system: `getServerSnapshot` answers the default, so
 * SSR and the hydration render agree byte for byte, and React swaps to this
 * browser's real answer immediately afterwards without ever comparing the two.
 *
 * It is the same store the meeting write-up panels use for their own persisted
 * open/closed state (features/meetings/components/meeting-panels.tsx) — the
 * existing pattern in this repo for exactly this problem, down to the same-tab
 * event and the memory fallback.
 *
 * THE TRADE IT MAKES, stated plainly: somebody who chose the rail gets one
 * frame of the wide sidebar on first paint before React corrects it. The only
 * way to remove that frame is the pre-paint route theme-provider.tsx takes —
 * an inline script in <head> writing an attribute on <html>, with the collapsed
 * geometry expressed in CSS instead of in these class names. That is a bigger
 * change across globals.css and the root layout, and it moves the source of
 * truth for the width out of the component; it is the upgrade path if the flash
 * ever proves worth it, not a bug in this.
 */

/**
 * Same-tab writes announce themselves on this event; the native 'storage'
 * event only fires in OTHER tabs, so a store built on it alone would leave the
 * tab doing the toggling as the one tab that did not re-render.
 */
const SIDEBAR_EVENT = 'logpup:sidebar'

/**
 * Where the choice lands when localStorage refuses the write (private mode, a
 * hardened browser, quota): the toggle still works for this session, it just is
 * not remembered. Read first so the snapshot agrees with what is on screen —
 * without it, a refused write would leave `getSnapshot` reporting the old state
 * forever and the sidebar would spring back on the next re-render.
 */
let memoryFallback: string | null = null

/** Reads never throw: blocked storage just means the default. */
function readStored(): string | null {
  if (memoryFallback !== null) return memoryFallback
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
  } catch {
    return null
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  window.addEventListener(SIDEBAR_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(SIDEBAR_EVENT, callback)
  }
}

/* Returns a string primitive, so it is referentially stable while the store is
   unchanged — the property useSyncExternalStore loops forever without. */
function getSnapshot(): SidebarState {
  return resolveSidebarState(readStored())
}

function getServerSnapshot(): SidebarState {
  return DEFAULT_SIDEBAR_STATE
}

/** What this browser wants. `DEFAULT_SIDEBAR_STATE` on the server. */
export function useSidebarState(): SidebarState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * The store IS the state: writing storage and broadcasting is what re-renders
 * every subscriber — the sidebar, the ⌘K palette row that names the state, and
 * any other tab this person has open.
 */
export function setSidebarState(next: SidebarState): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next)
    memoryFallback = null
  } catch {
    /* Not an error worth interrupting anyone over — a preference that cannot
       be saved is still a preference that applies. */
    memoryFallback = next
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT))
}

/** Flips it, reading the current value from the store rather than a closure. */
export function toggleSidebar(): void {
  setSidebarState(nextSidebarState(getSnapshot()))
}
