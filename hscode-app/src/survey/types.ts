import type { FactoryLocation, LocalizedName, Product } from '../lib/types'

export type ContactDraft = {
  phone?: string
  whatsapp?: string
  whatsappSameAsPhone?: boolean
  website?: string
  facebook?: string
  contactPerson?: string
}

export type PhotoData = { id: 'p1' | 'p2' | 'p3'; data: string }

export type FactoryInput = {
  name: LocalizedName
  area: string
  areaOther?: string
  address?: string
  sector?: string
  location: FactoryLocation
  productsMade: Product[]
  productsNeeded: Product[]
  contact: ContactDraft
  photos: PhotoData[]
  thumb?: string
}
