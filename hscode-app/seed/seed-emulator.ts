// Seeds the local Firebase emulators with demo data.
// Run inside emulators:exec (or with FIRESTORE_EMULATOR_HOST set): npm run seed:emu
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { toIndexEntry } from '../src/lib/indexEntry.ts'
import type { Factory, Product } from '../src/lib/types.ts'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
initializeApp({ projectId: 'demo-hscode' })
const db = getFirestore()

const now = new Date()

const product = (en: string, ar: string, heading: string): Product => ({
  name: { en, ar },
  hs: { heading },
})

const base = {
  photoCount: 0,
  status: 'approved' as const,
  createdBy: 's1',
  createdAt: now,
  updatedAt: now,
  approvedAt: now,
  sample: true,
}

const factories: { f: Factory; contact: Record<string, unknown> }[] = [
  {
    f: {
      ...base,
      id: 'demo-feed-mill',
      name: { en: 'Delta Feed Mill', ar: 'مطحنة الدلتا للأعلاف' },
      area: 'oct6-zone-3',
      sector: 'animal-feed',
      address: 'Block 12, 6th of October',
      location: { lat: 29.9727, lng: 30.9421, accuracyM: 10, pinMoved: false },
      productsMade: [product('Poultry feed', 'علف دواجن', '2309')],
      productsNeeded: [product('Maize', 'ذرة', '1005'), product('Soybean meal', 'كسب فول الصويا', '2304')],
    },
    contact: { phone: '+20 100 000 0001', whatsappSameAsPhone: true, contactPerson: 'Eng. Samir' },
  },
  {
    f: {
      ...base,
      id: 'demo-cables',
      name: { en: 'Nile Cables', ar: 'كابلات النيل' },
      area: 'oct6-zone-2',
      sector: 'electrical-cables',
      location: { lat: 29.9237, lng: 30.9023, accuracyM: 15, pinMoved: false },
      productsMade: [product('Insulated cables', 'كابلات معزولة', '8544')],
      productsNeeded: [],
    },
    contact: { phone: '+20 100 000 0002', whatsappSameAsPhone: true, contactPerson: 'Eng. Hala' },
  },
  {
    f: {
      ...base,
      id: 'demo-plastics',
      name: { en: 'Pyramid Plastics', ar: 'بلاستيك الأهرام' },
      area: 'oct6-zone-1',
      sector: 'plastics-packaging',
      location: { lat: 29.9228, lng: 30.9129, accuracyM: 20, pinMoved: false },
      productsMade: [product('Plastic bottles and caps', 'زجاجات وأغطية بلاستيك', '3923')],
      productsNeeded: [],
    },
    contact: { phone: '+20 100 000 0003', whatsappSameAsPhone: true, contactPerson: 'Mr. Karim' },
  },
]

const ts = (d: Date) => Timestamp.fromDate(d)

const batch = db.batch()

for (const { f, contact } of factories) {
  const { id, ...rest } = f
  batch.set(db.doc(`factories/${id}`), {
    ...rest,
    createdAt: ts(f.createdAt),
    updatedAt: ts(f.updatedAt),
    approvedAt: ts(f.approvedAt!),
  })
  batch.set(db.doc(`factories/${id}/private/contact`), contact)
}

batch.set(db.doc('searchIndex/shard-0'), {
  version: 1,
  updatedAt: Timestamp.now(),
  entries: factories.map(({ f }) => toIndexEntry(f)),
})

batch.set(db.doc('invites/482913'), { usedBy: null, cancelled: false, createdAt: Timestamp.now() })
batch.set(db.doc('invites/111111'), {
  usedBy: 's1',
  usedAt: Timestamp.now(),
  cancelled: false,
  createdAt: Timestamp.now(),
})

const user = (role: string, name: string) => ({
  role,
  active: true,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  createdAt: Timestamp.now(),
})
batch.set(db.doc('users/s1'), { ...user('surveyor', 'Demo Surveyor'), inviteCode: '111111' })
batch.set(db.doc('users/c1'), user('client', 'Demo Client'))

await batch.commit()
console.log(`Seeded ${factories.length} factories, 2 invites, 2 users.`)
