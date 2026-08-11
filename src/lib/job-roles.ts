// Single source of truth for the "Job role" field used across admin surfaces
// (add-user dialog, user table). Stored as free text in users.title — this
// list is a curated set of suggestions, not an enum, so existing rows and
// unusual titles keep working (see job-role-select.tsx).

// One cap for the whole field, in one place. The zod schema that enforces it
// lives in features/auth/title-schema.ts and imports this constant; the
// "Other…" free-text input in job-role-select.tsx uses it for maxLength. Kept
// here (a zero-dependency module) so the client input can share the number
// without pulling zod into the browser bundle. Three independent caps on one
// column is exactly how the admin table once rejected strings the Add-user
// dialog happily accepted.
export const JOB_ROLE_MAX_LENGTH = 60

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
      'Associate Software Engineer',
      'Senior Software Engineer',
      'Principal Engineer',
      'Mobile Engineer (iOS)',
      'Mobile Engineer (Android)',
      'Data Analyst',
      'Data Scientist',
      'Database Administrator',
      'Systems Engineer',
      'Network Engineer',
      'Security Engineer',
      'Site Reliability Engineer',
      'Automation QA Engineer',
      'Embedded/IoT Engineer',
    ],
  },
  {
    label: 'Engineering (EMC / hardware)',
    roles: [
      'Electronics Engineer',
      'Embedded / Firmware Engineer',
      'Hardware Engineer',
      'EMC Test Engineer',
      'RF Engineer',
      'Compliance Engineer',
      'PCB Designer',
      'Test Technician',
      'Project Engineer',
    ],
  },
  {
    label: 'Design',
    roles: [
      'UI/UX Designer',
      'Product Designer',
      'Graphic Designer',
      'UX Researcher',
      'Motion Designer',
      'Brand Designer',
    ],
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
      // 'Chief Technology Officer' is intentionally omitted — 'CTO' above
      // already covers that role; adding both would be a semantic duplicate.
      'Delivery Manager',
      'Program Manager',
      'Technical Program Manager',
      'Product Owner',
      'Chief Operating Officer',
    ],
  },
  {
    label: 'Operations',
    roles: [
      'HR',
      'Finance',
      'Marketing',
      'Sales',
      'Support',
      'Administrator',
      'Talent Acquisition',
      'Office Administrator',
      'Accountant',
      'Customer Success',
      'Business Development',
      'Legal',
    ],
  },
  {
    label: 'Other',
    roles: ['Intern', 'Consultant', 'Contractor', 'Trainee', 'Freelancer', 'Other'],
  },
] as const

export const JOB_ROLES: readonly string[] = JOB_ROLE_GROUPS.flatMap((group) => group.roles)
