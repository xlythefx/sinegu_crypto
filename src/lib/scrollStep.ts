/**
 * Which step of a list the reader has reached, from where the steps sit on
 * the screen. Pure: the caller measures (`hooks/useScrollStep.ts`), this
 * decides. Used by the home page's "What happens when the strategy trades",
 * whose highlight follows the scroll (owner, 2026-11-26).
 */

/**
 * Steps stacked one under another (a phone): the last step whose top has
 * risen past the reading line. Before any has, the first is the one being
 * read; once all have, the last.
 */
export function stepAtLine(tops: number[], line: number): number {
  let active = 0
  tops.forEach((top, i) => {
    if (top <= line) active = i
  })
  return active
}

/**
 * Steps side by side (a wide screen): they share one top, so the list's own
 * travel up the screen picks the step — the first while its top is still at
 * `from`, the last once it has risen to `to`, evenly in between.
 */
export function stepByTravel(top: number, from: number, to: number, count: number): number {
  if (count <= 1 || from <= to) return 0
  const progress = (from - top) / (from - to)
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)))
}

/**
 * Steps side by side, PINNED (owner, 2026-11-27: "the whole strip fixed and
 * static"): the section is a tall track whose content sticks to the screen,
 * so the track's own scroll picks the step. The first while the track's top
 * has not yet reached the top of the screen, the last once its bottom has
 * reached the bottom of the screen, evenly in between. A track no taller than
 * the screen is not pinned, and stays on the first step.
 */
export function stepInPin(top: number, height: number, viewport: number, count: number): number {
  return stepByTravel(top, 0, viewport - height, count)
}
