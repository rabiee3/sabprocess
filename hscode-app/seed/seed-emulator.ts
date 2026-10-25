// Seeds the local Firebase emulators with demo data.
// Run inside emulators:exec (or with FIRESTORE_EMULATOR_HOST set): npm run seed:emu
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { ADMIN_UID } from '../src/firebase/config.ts'
import { toIndexEntry } from '../src/lib/indexEntry.ts'
import type { Factory, Product } from '../src/lib/types.ts'

// Emulator only: the admin password below must never reach a real project.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('seed-emulator refuses to run without FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST.')
  process.exit(1)
}
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

batch.set(db.doc('invites/012345'), { usedBy: null, cancelled: false, createdAt: Timestamp.now() })

// A rejected submission by s1, for trying "Fix and resubmit" by hand in dev.
batch.set(db.doc('factories/demo-rejected'), {
  name: { en: 'Rejected Demo Works', ar: '' },
  area: 'oct6-zone-1',
  sector: 'plastics-packaging',
  location: { lat: 29.9228, lng: 30.9129, accuracyM: 20, pinMoved: true },
  productsMade: [product('Plastic crates', '', '3923')],
  productsNeeded: [],
  photoCount: 0,
  status: 'rejected',
  rejectReason: 'Photo is blurry',
  createdBy: 's1',
  createdAt: ts(now),
  updatedAt: ts(now),
  sample: false,
})
batch.set(db.doc('factories/demo-rejected/private/contact'), { phone: '+20 100 000 0004', whatsappSameAsPhone: true })

const user = (role: string, name: string) => ({
  role,
  active: true,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  createdAt: Timestamp.now(),
})
batch.set(db.doc('users/s1'), { ...user('surveyor', 'Demo Surveyor'), inviteCode: '111111' })
batch.set(db.doc('users/c1'), user('client', 'Demo Client'))

// Two pending submissions by s1 for the admin review queue: weak GPS + pin never moved, and a hand-placed pin.
const pending = (id: string, en: string, ar: string, location: Factory['location']) => {
  batch.set(db.doc(`factories/${id}`), {
    name: { en, ar },
    area: 'oct6-zone-1',
    sector: 'plastics-packaging',
    location,
    productsMade: [product('Plastic crates', 'صناديق بلاستيك', '3923')],
    productsNeeded: [],
    photoCount: 0,
    status: 'pending',
    createdBy: 's1',
    createdAt: ts(now),
    updatedAt: ts(now),
    sample: false,
  })
  batch.set(db.doc(`factories/${id}/private/contact`), { phone: '+20 100 000 0005', whatsappSameAsPhone: true })
}
pending('demo-pending-gps', 'Pending Gps Works', 'أعمال معلقة', { lat: 29.9231, lng: 30.9129, accuracyM: 85, pinMoved: false })
pending('demo-pending-hand', 'Pending Hand Works', 'أعمال يدوية', { lat: 29.9241, lng: 30.9135, accuracyM: null, pinMoved: true })

await batch.commit()

// The admin account (email + password sign-in) in the Auth emulator; its uid is the app's ADMIN_UID.
const auth = getAuth()
await auth.deleteUser(ADMIN_UID).catch(() => {})
await auth.createUser({ uid: ADMIN_UID, email: 'admin@example.test', password: 'emulator-only-123', emailVerified: true })

console.log(`Seeded ${factories.length} approved factories, 2 pending, 3 invites, 2 users, 1 rejected factory, 1 admin account.`)
