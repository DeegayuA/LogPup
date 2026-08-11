// Maps an email's domain to a human-readable organization name. Used to
// auto-fill the admin Users table's Organizations column (and to seed
// orgTags at account provisioning) when no one has set one explicitly.
const DOMAIN_TO_ORG: Record<string, string> = {
  'altavision.lk': 'Alta Vision',
  'altavision.co.uk': 'Alta Vision UK',
  'syntaxgenie.com': 'Syntax Genie',
  'pearlcluster.lk': 'Pearl Cluster',
  'gmail.com': 'Personal',
}

export function orgForEmail(email: string): string | undefined {
  const at = email.lastIndexOf('@')
  if (at === -1) return undefined
  const domain = email.slice(at + 1).toLowerCase()
  return DOMAIN_TO_ORG[domain]
}
