import { LogOut, User } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * Your own account, from the palette.
 *
 * /profile is here rather than in the nav registry on purpose: it is not a
 * workspace destination you bounce between all day, it is where your own
 * settings live, and the sidebar reaches it through the account footer
 * instead of a nav row.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'auth.profile',
    label: 'Profile',
    keywords: ['account', 'my details', 'password', 'passkey', 'avatar'],
    group: 'navigate',
    icon: User,
    href: '/profile',
  },
  {
    id: 'auth.sign-out',
    label: 'Sign out',
    keywords: ['log out', 'logout', 'leave'],
    group: 'command',
    icon: LogOut,
    run: async ({ close }) => {
      /* Close first: the action redirects to /sign-in, and a dialog left open
         across that navigation flashes over the sign-in page. */
      close()
      /* Imported here rather than at the top of the file so this module stays
         pure data at load time. A static import would drag next-auth into the
         module graph of every surface that reads the registry — Next resolves
         it safely for the browser, but it also means the registry can no
         longer be imported by a plain node test, which is where the drift
         guard runs. */
      const { signOutFromPalette } = await import('@/features/search/actions')
      void signOutFromPalette()
    },
  },
]
