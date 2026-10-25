export interface LocalizedName {
  en?: string;
  ar?: string;
}

export interface HsCode {
  heading: string;
  sub?: string;
  tariff?: string;
}

export interface Product {
  name: LocalizedName;
  hs?: HsCode;
}

export type FactoryStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export interface FactoryLocation {
  lat: number;
  lng: number;
  accuracyM: number | null;
  pinMoved: boolean;
}

export interface Factory {
  id: string;
  name: LocalizedName;
  area: string;
  areaOther?: string;
  address?: string;
  sector?: string;
  location: FactoryLocation;
  productsMade: Product[];
  productsNeeded: Product[];
  thumb?: string;
  photoCount: number;
  status: FactoryStatus;
  rejectReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  sample?: boolean;
}

export interface IndexEntry {
  id: string;
  n: LocalizedName;
  lat: number;
  lng: number;
  a: string;
  s?: string;
  m: { n: LocalizedName; h?: string }[];
  d: { n: LocalizedName; h?: string }[];
  at?: number;
}

export const EGYPT_BOUNDS = { minLat: 21.5, maxLat: 32, minLng: 24.5, maxLng: 37 } as const;
