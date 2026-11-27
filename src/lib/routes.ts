/**
 * Route strings that more than one place needs to agree on.
 *
 * `/auth` opens the SIGN-IN form by default, which is right for a "Sign in"
 * link and wrong for every "Register" button on the marketing pages — those
 * sent a first-time visitor to a form they have no account for, with the
 * register switch hidden at the bottom of the panel. The `mode` param is what
 * Auth reads to decide which form opens.
 */

export const SIGN_IN_PATH = '/auth'
export const REGISTER_PATH = '/auth?mode=register'

/** The home page as it was until 2026-11-27, kept when the redesign took `/`
 *  (owner's request). Counted in `lib/visitPages.ts`; noindex. */
export const CLASSIC_LANDING_PATH = '/classic'

/** Where the redesign was previewed (2026-11-25 → 11-27); redirects to `/`,
 *  so links already shared (to-do list, chats) still land on the home page. */
export const LANDING_PREVIEW_PATH = '/preview/landing'
