/** True when the factory page was opened from the map (root or the legacy /map), so Back can use history. */
export function isFromMap(from: unknown): from is string {
  return typeof from === 'string' && /^(\/|\/map)([?#].*)?$/.test(from)
}
