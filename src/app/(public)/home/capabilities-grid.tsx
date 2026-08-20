'use client'

import {
  LayoutDashboard,
  FileText,
  Boxes,
  Users,
  KanbanSquare,
  Milestone,
  Calendar,
  Sparkles,
  Command,
  ShieldCheck,
} from 'lucide-react'
import { SpotlightCard } from './spotlight-card'

const CAPABILITIES = [
  {
    n: '01',
    name: 'Dashboard',
    icon: LayoutDashboard,
    detail: 'The morning briefing: due tasks, overdue alerts, owed follow-ups, and today’s meetings.',
  },
  {
    n: '02',
    name: 'Work Log',
    icon: FileText,
    detail: 'One entry a day, self-scored: what got done, and how much of the plan was completed.',
  },
  {
    n: '03',
    name: 'App Portfolio',
    icon: Boxes,
    detail: 'Full product records: status, tech stack, lead, health radar, and assigned engineers.',
  },
  {
    n: '04',
    name: 'People & Capacity',
    icon: Users,
    detail: 'Allocation per person per app, turning amber at 80% and red overflow past 100%.',
  },
  {
    n: '05',
    name: 'Sprints & Kanban',
    icon: KanbanSquare,
    detail: 'Direct drag-and-drop board, sprint backlog, check-ins, and role-gated move permissions.',
  },
  {
    n: '06',
    name: 'Unified Roadmap',
    icon: Milestone,
    detail: 'Every studio app mapped on one chronological timeline, with a line drawn through today.',
  },
  {
    n: '07',
    name: 'Meetings',
    icon: Calendar,
    detail: 'Schedule here; Google Calendar events and team invitations sync automatically.',
  },
  {
    n: '08',
    name: 'Meeting Intelligence',
    icon: Sparkles,
    detail: 'In-browser mic & screen recording; Gemini creates English & Sinhala notes with action items.',
  },
  {
    n: '09',
    name: '⌘K Command Center',
    icon: Command,
    detail: 'Spotlight-style universal search over apps, people, tasks, sprints, and meetings in ≤3 keys.',
  },
  {
    n: '10',
    name: 'Access & Security',
    icon: ShieldCheck,
    detail: 'Two roles, server-enforced mutations, AES-256 encrypted keys, and complete audit logging.',
  },
] as const

export function CapabilitiesGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {CAPABILITIES.map((item) => {
        const Icon = item.icon
        return (
          <SpotlightCard
            key={item.n}
            spotlightColor="rgba(16, 185, 129, 0.14)"
            className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card/40 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-md hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="font-mono text-2xs font-bold text-primary">{item.n}</span>
                <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
              </div>
              <h4 className="mt-3 font-heading text-base font-bold text-foreground group-hover:text-primary transition-colors duration-200">
                {item.name}
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
            </div>
          </SpotlightCard>
        )
      })}
    </div>
  )
}
