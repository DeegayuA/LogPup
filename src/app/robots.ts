import type { MetadataRoute } from 'next'

/**
 * Only the four pages a signed-out visitor is meant to see are crawlable. The
 * rest of LogPup redirects to /sign-in anyway (src/proxy.ts), but an allow-all
 * robots.txt still invites crawlers to enumerate internal URLs — /apps/<slug>,
 * /meetings, /people — and leak the shape of a private workspace through search
 * results that go nowhere.
 *
 * Allow rules are listed before Disallow deliberately: they are more specific
 * paths, and a crawler resolves conflicts by longest match, so `/privacy` wins
 * over the bare `/` disallow.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/home', '/privacy', '/terms', '/sign-in'],
      disallow: '/',
    },
  }
}
