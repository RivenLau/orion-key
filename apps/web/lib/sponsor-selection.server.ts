import { randomInt } from "node:crypto"

/** Filter and sort once, then optionally choose a fresh random starting poster. */
export function orderSponsorPosters<T extends { enabled: boolean; sort_order?: number }>(posters: readonly T[], startFromFirst = false): T[] {
  const ordered = posters.map((poster, index) => ({ poster, order: poster.sort_order ?? index + 1 }))
    .filter(({ poster }) => poster.enabled)
    .sort((a, b) => a.order - b.order)
    .map(({ poster }) => poster)
  if (ordered.length < 2 || startFromFirst) return ordered

  const start = randomInt(ordered.length)

  // Rotate the list before rendering so SSR and hydration display the same first poster.
  return [...ordered.slice(start), ...ordered.slice(0, start)]
}
