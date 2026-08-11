// Curated job-role options for user titles and app-assignment roles.
// Free text stays allowed everywhere — these are suggestions, not an enum,
// so existing rows and unusual titles keep working.

export const SOFTWARE_ROLES = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full-stack Developer',
  'Mobile Developer',
  'DevOps Engineer',
  'QA Engineer',
  'Data Engineer',
  'ML Engineer',
  'UI/UX Designer',
  'Product Manager',
  'Tech Lead',
] as const

export const ENGINEERING_ROLES = [
  'Electronics Engineer',
  'Embedded / Firmware Engineer',
  'Hardware Engineer',
  'EMC Test Engineer',
  'RF Engineer',
  'Compliance Engineer',
  'PCB Designer',
  'Test Technician',
  'Project Engineer',
] as const

export const ROLE_GROUPS = [
  { label: 'Software', roles: SOFTWARE_ROLES },
  { label: 'Engineering (EMC)', roles: ENGINEERING_ROLES },
] as const

export const ALL_ROLES: readonly string[] = [...SOFTWARE_ROLES, ...ENGINEERING_ROLES]
