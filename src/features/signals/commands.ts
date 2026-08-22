import { Activity } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * Two rows, and the second one is the point.
 *
 * "My work signals" is listed for everybody, always, and it is not a
 * convenience. Fairness rule 5 says every figure a manager can see about a
 * person is on that person's own page in the same words — and a rule like that
 * is only real if the person can actually GET there. A surface reachable only
 * from a manager's view is a surveillance page with a symmetry clause in its
 * documentation.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'signals.mine',
    label: 'My work signals',
    keywords: ['kpi', 'productivity', 'scorecard', 'corroboration', 'my numbers', 'output'],
    group: 'navigate',
    icon: Activity,
    href: '/signals',
  },
  {
    id: 'signals.quiet',
    label: 'Quiet stretches',
    keywords: ['no activity', 'nothing logged', 'silent', 'unclaimed work', 'missing worklog'],
    group: 'navigate',
    icon: Activity,
    href: '/signals#quiet',
  },
]
