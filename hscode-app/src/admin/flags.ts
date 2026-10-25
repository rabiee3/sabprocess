import type { Factory } from '../lib/types'

export type Flag = 'lowAccuracy' | 'manual' | 'pinNeverMoved'

/** GPS accuracy above this many metres is "low". */
export const LOW_ACCURACY_M = 50

/** Location-quality flags the admin should double-check before approving. */
export function factoryFlags(f: Factory): Flag[] {
  const { accuracyM, pinMoved } = f.location
  const out: Flag[] = []
  if (accuracyM !== null && accuracyM > LOW_ACCURACY_M) out.push('lowAccuracy')
  if (accuracyM === null) out.push('manual')
  if (pinMoved === false) out.push('pinNeverMoved')
  return out
}
