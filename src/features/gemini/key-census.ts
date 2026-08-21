/**
 * Who is paying for the workspace's AI, and who is keeping their key to
 * themselves.
 *
 * Two questions asked from two different places, answered here once so they
 * cannot disagree:
 *
 *   - The AI engine card credits the people whose SHARED keys carry everyone
 *     else's requests. Naming them is the point: a shared key is somebody
 *     spending their own free-tier quota on the studio, and "2 Gemini keys,
 *     all working" thanks nobody.
 *   - An admin needs the census — how many keys exist, how many are shared,
 *     how many are private, per person — to know whether the pool is one
 *     generous person away from collapsing.
 *
 * WHAT IS AND IS NOT DISCLOSED. `shared: true` is an opt-in the owner made
 * (geminiKeys.shared, default false), and sharing is already visible in its
 * effects — a shared key's quota is spent by everyone. Naming its owner
 * therefore discloses nothing the act of sharing did not, and it is the
 * difference between a contribution and an anonymous resource.
 *
 * A PRIVATE key is different. Its existence is a fact an admin legitimately
 * needs — it separates "this person has no AI" from "this person has AI and is
 * not funding yours" — but the census counts private keys WITHOUT naming or
 * labelling them, and `contributors` never includes somebody on the strength
 * of a private key. Nobody is credited, or exposed, for a key they chose not
 * to share.
 */

/** One key, reduced to what either question needs. */
export type KeyOwnership = {
  userId: string
  userName: string
  /** The owner opted this key into the workspace pool. */
  shared: boolean
  /** Deactivated keys stay on the books but carry nothing. */
  active: boolean
}

export type PersonKeyCensus = {
  userId: string
  userName: string
  total: number
  shared: number
  private: number
}

export type KeyCensus = {
  totalKeys: number
  sharedKeys: number
  privateKeys: number
  /** People with at least one ACTIVE shared key — the ones carrying the pool. */
  contributors: string[]
  /** Every key holder, most keys first, then alphabetical. */
  people: PersonKeyCensus[]
}

/**
 * The whole picture, from a flat list of keys.
 *
 * Counts INACTIVE keys in the per-person totals, because an admin asking "how
 * many keys are in the system" is asking about the books, not the pool — a
 * deactivated key is still a key someone holds and can switch back on.
 * `contributors` uses the opposite rule and requires active, because that line
 * thanks people for work being done right now; crediting a switched-off key
 * would be thanking somebody for carrying requests it is not carrying.
 */
export function keyCensus(keys: readonly KeyOwnership[]): KeyCensus {
  const byUser = new Map<string, PersonKeyCensus>()

  for (const key of keys) {
    const row = byUser.get(key.userId) ?? {
      userId: key.userId,
      userName: key.userName,
      total: 0,
      shared: 0,
      private: 0,
    }
    row.total += 1
    if (key.shared) row.shared += 1
    else row.private += 1
    byUser.set(key.userId, row)
  }

  const people = [...byUser.values()].sort(
    (a, b) => b.total - a.total || a.userName.localeCompare(b.userName),
  )

  /* Distinct NAMES, not one per key: somebody who shared three keys is one
     person to thank, and listing them three times reads as a bug. */
  const contributors = [
    ...new Set(keys.filter((k) => k.shared && k.active).map((k) => k.userName)),
  ].sort((a, b) => a.localeCompare(b))

  return {
    totalKeys: keys.length,
    sharedKeys: keys.filter((k) => k.shared).length,
    privateKeys: keys.filter((k) => !k.shared).length,
    contributors,
    people,
  }
}

/**
 * The credit line: "Shared by Ishara and Nuwan".
 *
 * Names in full up to three, then "and N others" — a list long enough to wrap
 * stops reading as thanks and starts reading as a table. Returns null when
 * nobody has shared, so the caller renders nothing rather than an empty
 * flourish: there is no graceful way to thank zero people.
 */
export function creditLine(contributors: readonly string[]): string | null {
  if (contributors.length === 0) return null
  if (contributors.length === 1) return `Shared by ${contributors[0]}`
  if (contributors.length === 2) return `Shared by ${contributors[0]} and ${contributors[1]}`
  if (contributors.length === 3) {
    return `Shared by ${contributors[0]}, ${contributors[1]} and ${contributors[2]}`
  }
  const rest = contributors.length - 2
  return `Shared by ${contributors[0]}, ${contributors[1]} and ${rest} others`
}
