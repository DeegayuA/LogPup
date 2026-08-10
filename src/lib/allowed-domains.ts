// Email domains permitted to sign in, via any provider (Google, password, Notion).
// Configured with ALLOWED_EMAIL_DOMAINS (comma-separated); falls back to the legacy
// single-value ALLOWED_EMAIL_DOMAIN. Add more domains by editing the env var only.
export function allowedDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? ''
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

export function emailAllowed(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  const domain = email.slice(at + 1).toLowerCase()
  return allowedDomains().includes(domain)
}
