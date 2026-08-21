import { Rocket, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react'
import type { MaintenanceKind } from '../window'

/**
 * The face each kind of window wears.
 *
 * A Record rather than a ternary, for the reason spelled out on the
 * notification icon map: a two-arm conditional silently gives every kind it
 * did not name the same face, and the kind an admin picked is the one signal
 * telling people whether to worry.
 */
export const KIND_ICONS: Record<MaintenanceKind, LucideIcon> = {
  maintenance: Wrench,
  upgrade: Rocket,
  emergency: TriangleAlert,
}
