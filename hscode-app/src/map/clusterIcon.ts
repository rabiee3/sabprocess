import L from 'leaflet'

/** Ink circle, amber halo, white count (see assets/map/cluster.svg). Only a number goes into the HTML. */
export function clusterIcon(count: number): L.DivIcon {
  const size = count >= 100 ? 56 : count >= 10 ? 48 : 40
  const n = Math.max(0, Math.floor(Number(count) || 0))
  const html =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="${size}" height="${size}">` +
    '<circle cx="26" cy="26" r="25" fill="#ffc53d" fill-opacity="0.6"/>' +
    '<circle cx="26" cy="26" r="20" fill="#1f2224"/>' +
    `<text x="26" y="32" text-anchor="middle" font-family="IBM Plex Sans, Arial, sans-serif" font-size="17" font-weight="700" fill="#ffffff">${n}</text></svg>`
  return L.divIcon({ html, className: 'hs-cluster', iconSize: [size, size] })
}
