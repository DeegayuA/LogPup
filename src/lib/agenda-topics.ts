/**
 * E3 — deterministic role <-> agenda/title topic match (attendee recommender).
 *
 * A pure keyword table plus a matcher: does the agenda talk about the thing
 * this person's role owns? It is the model's only defence against
 * systematically demoting people whose work never becomes a database row —
 * the designer at her own design review, the QA engineer at the incident
 * review, the support lead at the escalation retro. A primary hit is the one
 * signal in the whole ledger that can floor a person to `required`
 * (attendee-score.ts, R6), so it has to actually reach every role in the
 * studio's vocabulary, not just the roles with a task board.
 *
 * THE LINT TEST IS THE POINT (agenda-topics.test.ts): every value in
 * JOB_ROLES (src/lib/job-roles.ts) must appear in at least one bucket's
 * `primaryRoles` or `adjacentRoles`. An 8-bucket table over a ~70-role
 * vocabulary silently zeroes Support, Finance, HR, Marketing and every
 * generalist engineer — and in the UI a structural zero is indistinguishable
 * from "we checked and they're not relevant". Role strings below are quoted
 * verbatim from JOB_ROLE_GROUPS; the lint compares against the real constant,
 * so a typo here shows up as a failing test, not a silent zero.
 *
 * `hit: 'tech'` is part of the shared return shape for the scorer
 * (attendee-score.ts), which sets it when apps.techTags overlaps the agenda
 * with no role hit (E3's "apps.techTags overlap, no role hit -> 3 pts"
 * branch). This module only ever returns 'primary' | 'adjacent' | 'none' —
 * it has no access to an app's tech tags, only role tokens.
 */

export type TopicBucket = {
  name: string
  keywords: string[]
  primaryRoles: string[]
  adjacentRoles: string[]
}

export type AgendaTopicMatch = {
  hit: 'primary' | 'adjacent' | 'tech' | 'none'
  bucket?: string
  quote?: string
}

export const TOPIC_BUCKETS: TopicBucket[] = [
  {
    name: 'Frontend & client engineering',
    keywords: [
      'frontend',
      'front-end',
      'ui',
      'interface',
      'component',
      'responsive',
      'browser',
      'client-side',
      'accessibility',
    ],
    primaryRoles: [
      'Frontend Developer',
      'Full-stack Developer',
      'Mobile Developer',
      'Mobile Engineer (iOS)',
      'Mobile Engineer (Android)',
    ],
    adjacentRoles: [
      'Software Engineer',
      'Associate Software Engineer',
      'Senior Software Engineer',
      'UI/UX Designer',
      'QA Engineer',
    ],
  },
  {
    name: 'Backend & API engineering',
    keywords: [
      'backend',
      'back-end',
      'api',
      'server',
      'endpoint',
      'integration',
      'microservice',
      'database',
      'migration',
    ],
    primaryRoles: ['Backend Developer', 'Full-stack Developer', 'Database Administrator'],
    adjacentRoles: [
      'Software Engineer',
      'Associate Software Engineer',
      'Senior Software Engineer',
      'Data Engineer',
      'DevOps Engineer',
    ],
  },
  {
    name: 'Design & UX',
    keywords: [
      'design',
      'mockup',
      'mockups',
      'wireframe',
      'wireframes',
      'prototype',
      'usability',
      'branding',
      'visual',
      'illustration',
    ],
    primaryRoles: [
      'UI/UX Designer',
      'Product Designer',
      'Graphic Designer',
      'UX Researcher',
      'Motion Designer',
      'Brand Designer',
    ],
    adjacentRoles: ['Product Manager', 'Frontend Developer', 'Freelancer'],
  },
  {
    name: 'QA & testing',
    keywords: ['qa', 'testing', 'regression', 'bug', 'defect', 'quality', 'test case', 'sign-off'],
    primaryRoles: ['QA Engineer', 'Automation QA Engineer'],
    adjacentRoles: ['Software Engineer', 'Test Technician', 'EMC Test Engineer', 'Compliance Engineer'],
  },
  {
    name: 'DevOps, infrastructure & security',
    keywords: [
      'devops',
      'infrastructure',
      'deployment',
      'pipeline',
      'incident',
      'outage',
      'uptime',
      'security',
      'network',
      'vulnerability',
    ],
    primaryRoles: [
      'DevOps Engineer',
      'Site Reliability Engineer',
      'Security Engineer',
      'Network Engineer',
      'Systems Engineer',
    ],
    adjacentRoles: ['Backend Developer', 'Software Engineer'],
  },
  {
    name: 'Data & machine learning',
    keywords: ['data', 'analytics', 'dataset', 'dashboard', 'model', 'machine learning', 'ml', 'metrics'],
    primaryRoles: ['Data Engineer', 'Data Analyst', 'Data Scientist', 'ML Engineer'],
    adjacentRoles: ['Backend Developer', 'Software Engineer'],
  },
  {
    name: 'Hardware & electronics',
    keywords: [
      'hardware',
      'pcb',
      'circuit',
      'firmware',
      'electronics',
      'embedded',
      'iot',
      'schematic',
      'enclosure',
    ],
    primaryRoles: [
      'Electronics Engineer',
      'Embedded / Firmware Engineer',
      'Hardware Engineer',
      'PCB Designer',
      'Embedded/IoT Engineer',
      'Project Engineer',
    ],
    adjacentRoles: ['Software Architect', 'Test Technician'],
  },
  {
    name: 'EMC, RF & compliance testing',
    keywords: [
      'emc',
      'rf',
      'compliance',
      'certification',
      'emissions',
      'immunity',
      'radiated',
      'conducted',
      'ce mark',
      'fcc',
    ],
    primaryRoles: ['EMC Test Engineer', 'RF Engineer', 'Compliance Engineer', 'Test Technician'],
    adjacentRoles: ['Hardware Engineer', 'QA Engineer', 'Legal'],
  },
  {
    name: 'Engineering architecture & leadership',
    keywords: [
      'architecture',
      'technical debt',
      'system design',
      'scalability',
      'refactor',
      'tech stack',
      'code review',
    ],
    primaryRoles: [
      'Tech Lead',
      'Software Architect',
      'Principal Engineer',
      'Engineering Manager',
      'Senior Software Engineer',
    ],
    adjacentRoles: ['Software Engineer', 'CTO', 'Associate Software Engineer'],
  },
  {
    name: 'Product & strategy',
    keywords: ['roadmap', 'product', 'requirements', 'backlog', 'prioritization', 'feature', 'spec'],
    primaryRoles: ['Product Manager', 'Product Owner', 'Business Analyst'],
    adjacentRoles: ['CEO', 'CTO', 'Director', 'Consultant'],
  },
  {
    name: 'Delivery & project management',
    keywords: [
      'sprint',
      'standup',
      'stand-up',
      'retro',
      'retrospective',
      'scrum',
      'milestone',
      'timeline',
      'schedule',
      'kanban',
    ],
    primaryRoles: [
      'Project Manager',
      'Scrum Master',
      'Delivery Manager',
      'Program Manager',
      'Technical Program Manager',
    ],
    adjacentRoles: ['Engineering Manager', 'Product Manager'],
  },
  {
    name: 'Executive & leadership',
    keywords: ['strategy', 'budget', 'quarterly', 'okr', 'okrs', 'board', 'executive', 'leadership'],
    primaryRoles: ['CEO', 'Chief Operating Officer', 'Director'],
    adjacentRoles: ['CTO', 'Engineering Manager', 'Product Manager'],
  },
  {
    name: 'HR & talent',
    keywords: ['hiring', 'recruitment', 'onboarding', 'interview', 'culture', 'performance review'],
    primaryRoles: ['HR', 'Talent Acquisition'],
    adjacentRoles: ['Office Administrator', 'Director', 'Intern', 'Trainee'],
  },
  {
    name: 'Finance & accounting',
    keywords: ['budget', 'invoice', 'expense', 'payroll', 'accounting', 'billing', 'financial'],
    primaryRoles: ['Finance', 'Accountant'],
    adjacentRoles: ['Chief Operating Officer', 'Director'],
  },
  {
    name: 'Marketing & sales',
    keywords: [
      'marketing',
      'campaign',
      'social media',
      'seo',
      'content',
      'sales',
      'pitch',
      'deal',
      'prospect',
    ],
    primaryRoles: ['Marketing', 'Sales', 'Business Development'],
    adjacentRoles: ['Brand Designer', 'CEO', 'Customer Success'],
  },
  {
    name: 'Support & customer success',
    keywords: ['support', 'ticket', 'helpdesk', 'help desk', 'escalation', 'customer', 'client issue'],
    primaryRoles: ['Support', 'Customer Success'],
    adjacentRoles: ['QA Engineer', 'Product Manager', 'Sales'],
  },
  {
    name: 'Legal & compliance',
    keywords: ['legal', 'contract', 'agreement', 'nda', 'policy', 'liability'],
    primaryRoles: ['Legal'],
    adjacentRoles: ['Compliance Engineer', 'Finance', 'Director'],
  },
  {
    name: 'Administration & office operations',
    keywords: ['admin', 'office', 'facilities', 'logistics', 'procurement', 'vendor'],
    primaryRoles: ['Administrator', 'Office Administrator'],
    adjacentRoles: ['HR', 'Finance', 'Contractor'],
  },
  {
    name: 'General & cross-functional engagement',
    keywords: [
      'kickoff',
      'kick-off',
      'onboarding',
      'orientation',
      'induction',
      'handover',
      'workshop',
      'training',
      'walkthrough',
    ],
    primaryRoles: [],
    adjacentRoles: ['Intern', 'Trainee', 'Consultant', 'Contractor', 'Freelancer', 'Other'],
  },
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The verbatim matched span of `keyword` in `text`, or null if it isn't there as a whole word. */
function findWholeWordMatch(text: string, keyword: string): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'iu')
  const match = pattern.exec(text)
  return match ? match[0] : null
}

function normalizeRoleToken(role: string): string {
  return role.trim().toLowerCase()
}

/**
 * Case-insensitive whole-word match of a TOPIC_BUCKETS keyword in `text`,
 * evaluated against `roleTokens` (typically [users.title, assignments.role]
 * for this candidate on this app).
 *
 * Every bucket whose keywords appear in `text` is a candidate; among those,
 * the best result for THIS candidate's role tokens wins (primary beats
 * adjacent beats no-hit) — the first bucket in TOPIC_BUCKETS order breaks
 * ties. That is what makes "the agenda mentions the frontend rewrite and the
 * QA sign-off" still floor a QA Engineer to primary, rather than losing them
 * to whichever bucket's keyword happened to appear first in the text.
 *
 * Buckets never stack: this returns a single hit, never a sum. A role that
 * matches no bucket for this text is 'none' — UNKNOWN to the scorer, never a
 * penalty, since this model has no negative terms (see spec E3).
 */
export function matchAgendaTopic(text: string, roleTokens: string[]): AgendaTopicMatch {
  const trimmed = text.trim()
  if (!trimmed) return { hit: 'none' }

  const normalizedTokens = new Set(
    roleTokens.filter((token): token is string => Boolean(token && token.trim())).map(normalizeRoleToken),
  )
  if (normalizedTokens.size === 0) return { hit: 'none' }

  let best: { level: 1 | 2; bucket: string; quote: string } | null = null

  for (const bucket of TOPIC_BUCKETS) {
    let quote: string | null = null
    for (const keyword of bucket.keywords) {
      const match = findWholeWordMatch(trimmed, keyword)
      if (match) {
        quote = match
        break
      }
    }
    if (!quote) continue // this bucket's topic isn't in the agenda at all

    const isPrimary = bucket.primaryRoles.some((role) => normalizedTokens.has(normalizeRoleToken(role)))
    const isAdjacent =
      !isPrimary && bucket.adjacentRoles.some((role) => normalizedTokens.has(normalizeRoleToken(role)))

    const level: 0 | 1 | 2 = isPrimary ? 2 : isAdjacent ? 1 : 0
    if (level === 0) continue // topic matched, but not this candidate's role — keep looking

    if (!best || level > best.level) {
      best = { level: level as 1 | 2, bucket: bucket.name, quote }
    }
    if (level === 2) break // primary is the ceiling; no later bucket can beat it
  }

  if (!best) return { hit: 'none' }
  return { hit: best.level === 2 ? 'primary' : 'adjacent', bucket: best.bucket, quote: best.quote }
}
