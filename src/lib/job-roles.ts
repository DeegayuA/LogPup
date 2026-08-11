// Single source of truth for the "Job role" field used across admin surfaces
// (add-user dialog, user table). Stored as free text in users.title — this
// list is a curated set of suggestions, not an enum, so existing rows and
// unusual titles keep working (see job-role-select.tsx).

export const JOB_ROLE_GROUPS = [
  {
    label: 'Engineering',
    roles: [
      'Software Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Full-stack Developer',
      'Mobile Developer',
      'DevOps Engineer',
      'QA Engineer',
      'Data Engineer',
      'ML Engineer',
      'Tech Lead',
      'Software Architect',
    ],
  },
  {
    label: 'Design',
    roles: ['UI/UX Designer', 'Product Designer', 'Graphic Designer'],
  },
  {
    label: 'Product & Management',
    roles: [
      'Product Manager',
      'Project Manager',
      'Business Analyst',
      'Scrum Master',
      'Engineering Manager',
      'CTO',
      'CEO',
      'Director',
    ],
  },
  {
    label: 'Operations',
    roles: ['HR', 'Finance', 'Marketing', 'Sales', 'Support', 'Administrator'],
  },
  {
    label: 'Other',
    roles: ['Intern', 'Consultant', 'Other'],
  },
] as const

export const JOB_ROLES: readonly string[] = JOB_ROLE_GROUPS.flatMap((group) => group.roles)
