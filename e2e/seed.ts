// CLI entry point: `npm run e2e:seed` (== `tsx e2e/seed.ts`). See
// `e2e/seed-user.ts` for what this actually does — this file just wires it
// up to be runnable standalone, outside of the Playwright test runner.
import './env'
import { seedDevUser } from './seed-user'

seedDevUser()
  .then((result) => {
    console.log(
      result.created
        ? `[e2e:seed] created ${result.email} (role=${result.role})`
        : `[e2e:seed] ${result.email} already exists (role=${result.role})`,
    )
    process.exit(0)
  })
  .catch((error) => {
    console.error('[e2e:seed] failed:', error)
    process.exit(1)
  })
