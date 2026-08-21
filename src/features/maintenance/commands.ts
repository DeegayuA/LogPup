import { Wrench } from 'lucide-react'
import { isAdminRole } from '@/features/auth/capabilities'
import type { CommandDescriptor } from '@/features/search/registry/types'
import { OPEN_CONTROLS_EVENT } from './events'

/**
 * The one maintenance action that needs no target row: open the controls.
 *
 * The console command exists for the case where the palette is unreachable —
 * a signed-in admin sitting on /sign-in, a shell that has stopped rendering.
 * This is the same door for the ordinary case, where hunting for a password is
 * theatre.
 *
 * `visible` is presentation, as types.ts says: it declutters the palette for
 * the seats that cannot use the row. What refuses a non-admin is
 * `maintenance.manage` in the server action, and the gate re-checks the seat
 * before it will render the popup at all.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'maintenance.controls',
    label: 'Maintenance window',
    keywords: ['downtime', 'planned maintenance', 'close logpup', 'lockdown', 'upgrade', 'outage'],
    group: 'command',
    icon: Wrench,
    visible: (ctx) => isAdminRole(ctx.user.role),
    run: ({ close }) => {
      close()
      window.dispatchEvent(new Event(OPEN_CONTROLS_EVENT))
    },
  },
]
