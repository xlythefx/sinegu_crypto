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
