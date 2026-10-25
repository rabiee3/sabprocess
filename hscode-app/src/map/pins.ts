import L from 'leaflet'
import defaultPin from '../assets/map/pin-default.svg?raw'
import selectedPin from '../assets/map/pin-selected.svg?raw'
import flaggedPin from '../assets/map/pin-flagged.svg?raw'

const SVG = { default: defaultPin, selected: selectedPin, flagged: flaggedPin }

export type PinKind = keyof typeof SVG

export function pinIcon(kind: PinKind): L.DivIcon {
  return L.divIcon({
    html: SVG[kind],
    className: 'hs-pin',
    iconSize: [30, 38],
    iconAnchor: [15, 37],
  })
}
