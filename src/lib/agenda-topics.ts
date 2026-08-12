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

// GENERIC WORKPLACE KEYWORDS ARE BANNED AS BARE ENTRIES — see the denylist
// guard test in agenda-topics.test.ts ('TOPIC_BUCKETS keyword precision
// (denylist guard)'). Round 1 of review found nine common English words
// ("board", "model", "support", "network", "content", "schedule", "quality",
// "component", "database") firing on completely unrelated everyday usage
// ("circuit board", "pricing model" …), each replaced below with a qualifying
// multi-word phrase. Round 2 disclosed three more leftovers ("customer",
// "ticket", "migration") plus a full sweep of the remaining 19 buckets — 44
// more bare nouns across every bucket in the table (roadmap/product/feature,
// budget/strategy/executive, campaign/pitch/deal/prospect, infrastructure/
// pipeline/security, and so on), which is why nearly every bucket below now
// favours phrases over bare nouns. A bare single-word keyword only survives
// when it is genuinely domain-specific (e.g. "kubernetes"-class terms like
// "devops", "pcb", "kanban", "payroll") — see the guard test's denylist and
// its comment for the exact rule.
//
// One known, deliberate gap: the denylist also bans bare "sign-off" (round
// 2 — "get legal sign-off on the NDA" is not a QA release sign-off, the same
// class of bug as bare "support"), qualified below into "qa sign-off"/"test
// sign-off"/"release sign-off". A sentence that uses "sign-off" with no
// qualifying word at all (e.g. "Sign-off is pending") therefore does not hit
// this bucket — that is correct per the denylist's own reasoning, not a bug.
export const TOPIC_BUCKETS: TopicBucket[] = [
  {
    name: 'Frontend & client engineering',
    keywords: [
      'frontend',
      'front-end',
      'ui',
      // Bare "interface"/"responsive"/"accessibility" are routine outside
      // software: "interface with the vendor", "a responsive supplier",
      // "building accessibility" (wheelchair access) — none of them are the
      // frontend sense that should floor a Frontend Developer to required.
      'user interface',
      'interface design',
      'ui component',
      'react component',
      'frontend component',
      'responsive design',
      'responsive layout',
      'browser',
      'client-side',
      'web accessibility',
      'accessibility audit',
      'screen reader',
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
      // Bare "integration" is routine HR/onboarding language ("integration
      // of the new hire"); bare "database"/"migration" fire on any casual
      // mention ("a database of vendor contacts", "office migration") that
      // has nothing to do with the schema/engineering sense that should
      // floor a Backend Developer to required.
      'api integration',
      'system integration',
      'backend integration',
      'microservice',
      'database schema',
      'database migration',
      'database performance',
      'database query',
      'data migration',
      'schema migration',
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
      // Bare "prototype"/"branding"/"visual"/"illustration" are routine
      // outside design: a "prototype policy", "employer branding" (HR/
      // recruiting), "a visual in the report" (any deck), "as an
      // illustration of the point" (rhetorical, in any conversation).
      'design prototype',
      'interactive prototype',
      'clickable prototype',
      'usability',
      'brand design',
      'visual branding',
      'brand identity',
      'visual design',
      'custom illustration',
      'illustration work',
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
    keywords: [
      'qa',
      // Bare "testing" is routine outside QA ("testing the waters",
      // "testing a new pricing model" — see the agenda-topics/data-bucket
      // fix for the "model" half of that exact sentence); bare "quality" is
      // used loosely about almost anything ("quality craftsmanship"); bare
      // "sign-off" means approval on literally any document in any
      // department, not specifically a QA release sign-off.
      'manual testing',
      'automated testing',
      'user testing',
      'regression',
      'bug',
      'defect',
      'quality assurance',
      'quality control',
      'test case',
      'qa sign-off',
      'test sign-off',
      'release sign-off',
    ],
    primaryRoles: ['QA Engineer', 'Automation QA Engineer'],
    adjacentRoles: ['Software Engineer', 'Test Technician', 'EMC Test Engineer', 'Compliance Engineer'],
  },
  {
    name: 'DevOps, infrastructure & security',
    keywords: [
      'devops',
      // Bare "infrastructure"/"deployment"/"pipeline"/"incident"/"security"/
      // "vulnerability" are routine outside SRE/security ("state
      // infrastructure funding", "app store deployment", "sales pipeline",
      // "a diplomatic incident", "job security", "a vulnerability in the
      // argument") — the qualifying phrase is what actually means the
      // infra/security sense that should floor a DevOps/SRE/Security/
      // Network Engineer to required.
      'cloud infrastructure',
      'infrastructure review',
      'production deployment',
      'deployment pipeline',
      'build pipeline',
      'release pipeline',
      'incident response',
      'incident review',
      'production incident',
      'outage',
      'uptime',
      'security review',
      'security audit',
      'security incident',
      // Bare "network" fires on "partner network", "our network of
      // contacts" — none of which is the infra sense that should floor a
      // Network Engineer to required.
      'network outage',
      'network security',
      'network infrastructure',
      'network latency',
      'security vulnerability',
      'vulnerability scan',
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
    keywords: [
      // Bare "data"/"dashboard"/"metrics" are routine outside data
      // engineering ("sales data for the board deck", "an admin dashboard",
      // "growth metrics in the marketing deck") — the qualifying phrase is
      // what actually means the data/ML sense that should floor a Data
      // Engineer/Analyst/Scientist to required.
      'data pipeline',
      'data warehouse',
      'data engineering',
      'data quality',
      'data model',
      'analytics',
      'analytics dashboard',
      'data dashboard',
      'dataset',
      // Bare "model" fires on "pricing model", "business model" — everyday
      // business language that has nothing to do with an ML model.
      'ml model',
      'model training',
      'model accuracy',
      'model deployment',
      'machine learning',
      'ml',
      'data metrics',
      'model metrics',
    ],
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
      // Bare "embedded" is routine outside hardware ("an embedded video",
      // "power embedded in the org chart") — the qualifying phrase is what
      // actually means the embedded-systems sense.
      'embedded system',
      'embedded systems',
      'embedded software',
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
      // Bare "compliance"/"certification"/"emissions"/"immunity"/"conducted"
      // are routine outside EMC/regulatory testing ("in compliance with the
      // handbook", "a certification course", "carbon emissions", "immune to
      // criticism", "the interview was conducted virtually") — the
      // qualifying phrase is what actually means the EMC/compliance-testing
      // sense.
      'compliance testing',
      'regulatory compliance',
      'product certification',
      'certification testing',
      'radiated',
      'radiated emissions',
      'conducted emissions',
      'radiated immunity',
      'conducted immunity',
      'ce mark',
      'fcc',
    ],
    primaryRoles: ['EMC Test Engineer', 'RF Engineer', 'Compliance Engineer', 'Test Technician'],
    adjacentRoles: ['Hardware Engineer', 'QA Engineer', 'Legal'],
  },
  {
    name: 'Engineering architecture & leadership',
    keywords: [
      // Bare "architecture" is routine outside engineering ("the building's
      // architecture", "an architecture firm") — the qualifying phrase is
      // what actually means the software/system sense.
      'system architecture',
      'software architecture',
      'architecture review',
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
    keywords: [
      // Bare "roadmap"/"product"/"requirements"/"feature"/"spec" are routine
      // outside product management ("a roadmap for recovery", "a cleaning
      // product", "membership requirements", "a notable feature of the
      // building", "on spec for delivery") — the qualifying phrase is what
      // actually means the product-management sense that should floor a
      // Product Manager to required.
      'product roadmap',
      'roadmap planning',
      'product strategy',
      'product launch',
      'product requirements',
      'business requirements',
      'backlog',
      'prioritization',
      'feature request',
      'feature spec',
      'product spec',
      'technical spec',
    ],
    primaryRoles: ['Product Manager', 'Product Owner', 'Business Analyst'],
    adjacentRoles: ['CEO', 'CTO', 'Director', 'Consultant'],
  },
  {
    name: 'Delivery & project management',
    keywords: [
      'sprint',
      'standup',
      'stand-up',
      // Bare "retro"/"milestone"/"timeline" are routine outside delivery/PM
      // ("retro sneakers", "a personal milestone", "the timeline of
      // events") — the qualifying phrase is what actually means the
      // delivery-cadence sense.
      'sprint retro',
      'team retro',
      'retro meeting',
      'retrospective',
      'scrum',
      'project milestone',
      'delivery milestone',
      'project timeline',
      'delivery timeline',
      // Bare "schedule" fires on "let's schedule a call" — nearly every
      // meeting mentions scheduling something without being ABOUT delivery.
      'project schedule',
      'delivery schedule',
      'release schedule',
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
    keywords: [
      // Bare "strategy"/"budget"/"quarterly"/"executive"/"leadership" are
      // routine outside the C-suite ("a strategy game", "a tight travel
      // budget", "quarterly rent", "an executive decision by the toddler",
      // "leadership qualities on a resume") — the qualifying phrase is what
      // actually means the governance sense that should floor a CEO/
      // Director to required.
      'business strategy',
      'strategic planning',
      'strategy session',
      'budget review',
      'budget approval',
      'quarterly review',
      'quarterly results',
      'quarterly planning',
      'okr',
      'okrs',
      // Bare "board" fires on "circuit board" — the qualifying phrase is
      // what actually means the governance sense that should floor a CEO.
      'board meeting',
      'board update',
      'boardroom',
      'executive team',
      'executive meeting',
      'leadership team',
      'leadership meeting',
    ],
    primaryRoles: ['CEO', 'Chief Operating Officer', 'Director'],
    adjacentRoles: ['CTO', 'Engineering Manager', 'Product Manager'],
  },
  {
    name: 'HR & talent',
    keywords: [
      'hiring',
      'recruitment',
      'onboarding',
      // Bare "interview"/"culture" are routine outside HR ("press interview",
      // "company culture" used loosely, "food culture", "pop culture") — the
      // qualifying phrase is what actually means the HR/talent sense.
      'job interview',
      'candidate interview',
      'company culture',
      'team culture',
      'performance review',
    ],
    primaryRoles: ['HR', 'Talent Acquisition'],
    adjacentRoles: ['Office Administrator', 'Director', 'Intern', 'Trainee'],
  },
  {
    name: 'Finance & accounting',
    keywords: [
      // Bare "budget"/"financial" are routine outside finance ("a tight
      // travel budget", "financial aid", "personal financial goals") — the
      // qualifying phrase is what actually means the finance/accounting
      // sense.
      'budget review',
      'budget approval',
      'invoice',
      'expense',
      'payroll',
      'accounting',
      'billing',
      'financial report',
      'financial planning',
    ],
    primaryRoles: ['Finance', 'Accountant'],
    adjacentRoles: ['Chief Operating Officer', 'Director'],
  },
  {
    name: 'Marketing & sales',
    keywords: [
      'marketing',
      'social media',
      'seo',
      // Bare "content" fires on "response content", "page content" — any
      // API/UI discussion, not just marketing content.
      'content calendar',
      'content strategy',
      'marketing content',
      'sales',
      // Bare "campaign"/"pitch"/"deal"/"prospect" are routine outside
      // marketing/sales ("election campaign", "pitch a tent", "no big
      // deal", "a promising prospect for the team") — the qualifying
      // phrase is what actually means the marketing/sales sense.
      'marketing campaign',
      'ad campaign',
      'sales pitch',
      'investor pitch',
      'sales deal',
      'business deal',
      'sales prospect',
      'prospect outreach',
    ],
    primaryRoles: ['Marketing', 'Sales', 'Business Development'],
    adjacentRoles: ['Brand Designer', 'CEO', 'Customer Success'],
  },
  {
    name: 'Support & customer success',
    keywords: [
      // Bare "support" is one of the most overloaded verbs in English
      // ("does the schema support multi-tenant data?") — the qualifying
      // phrase is what actually means the customer-support sense.
      'customer support',
      'support ticket',
      'support team',
      'support queue',
      'technical support',
      'helpdesk',
      'help desk',
      // Bare "ticket"/"escalation"/"customer" are routine outside support
      // ("concert ticket", "military escalation", "a customer stopped by
      // the office", "customer feedback from a survey") — the qualifying
      // phrase is what actually means the customer-support sense.
      'customer escalation',
      'support escalation',
      'client issue',
    ],
    primaryRoles: ['Support', 'Customer Success'],
    adjacentRoles: ['QA Engineer', 'Product Manager', 'Sales'],
  },
  {
    name: 'Legal & compliance',
    keywords: [
      'legal',
      // Bare "contract"/"agreement"/"policy" are routine outside legal
      // ("we came to an agreement about lunch", "gym membership policy",
      // muscle "contract") — the qualifying phrase is what actually means
      // the legal/compliance sense.
      'legal contract',
      'contract review',
      'contract negotiation',
      'legal agreement',
      'settlement agreement',
      'nda',
      'policy review',
      'privacy policy',
      'liability',
    ],
    primaryRoles: ['Legal'],
    adjacentRoles: ['Compliance Engineer', 'Finance', 'Director'],
  },
  {
    name: 'Administration & office operations',
    keywords: [
      'admin',
      'office',
      'facilities',
      // Bare "logistics" is routine outside office operations ("dating
      // logistics", "the logistics of the trip") — the qualifying phrase is
      // what actually means the office-operations sense.
      'office logistics',
      'logistics coordination',
      'procurement',
      'vendor',
    ],
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

/**
 * Among `keywords`, the verbatim span that occurs EARLIEST in `text` (whole
 * word/phrase, case-insensitive), or null if none of them are there at all.
 *
 * Scanning every keyword rather than stopping at the first array-order hit
 * matters for the cited `quote`: a bucket can hold several keywords, and the
 * one that happens to sit first in the source array is not necessarily the
 * one closest to what the agenda is actually about. The earliest-occurring
 * span in the text is the more honest citation.
 */
function findEarliestKeywordMatch(text: string, keywords: string[]): string | null {
  let bestQuote: string | null = null
  let bestIndex = Infinity
  for (const keyword of keywords) {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'iu')
    const match = pattern.exec(text)
    if (!match) continue
    if (match.index < bestIndex) {
      bestIndex = match.index
      bestQuote = match[0]
    }
  }
  return bestQuote
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
 * ties between buckets. That is what makes "the agenda mentions the frontend
 * rewrite and the QA sign-off" still floor a QA Engineer to primary, rather
 * than losing them to whichever bucket's keyword happened to appear first in
 * the text. Within a single bucket, the cited quote is the EARLIEST-occurring
 * matching keyword in the text, not the first one listed in that bucket's
 * `keywords` array — a citation should point at the most contextually
 * relevant span, not an implementation detail of array order.
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
    const quote = findEarliestKeywordMatch(trimmed, bucket.keywords)
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
