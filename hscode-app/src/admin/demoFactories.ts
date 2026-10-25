import type { Product } from '../lib/types'
import type { FactoryInput } from '../survey/types'

/**
 * Bundled demo data for the admin Dashboard's "Load demo factories" button. Every entry is created
 * with `sample: true`; the English name is the stable key that makes loading idempotent.
 *
 * Two real companies (public information only, see docs/hscode/sample-factories.md) plus eight
 * clearly fictional ones. No phone numbers or other contact details anywhere, except the websites
 * of the two real companies.
 */

const p = (en: string, ar: string, heading: string, sub?: string): Product => ({
  name: { en, ar },
  hs: sub ? { heading, sub } : { heading },
})

const pin = (lat: number, lng: number) => ({ lat, lng, accuracyM: null, pinMoved: true })

/** Fictional factory: obvious demo names, no contact details. Pins sit near the zone centre from areas.json. */
const fake = (f: Omit<FactoryInput, 'contact' | 'photos'>): FactoryInput => ({ ...f, contact: {}, photos: [] })

// The two real factories' pins are APPROXIMATE PLACEHOLDERS: zone-level points in the Industrial Extension
// (areas.json centre is 29.9, 30.88; Juhayna is nudged so the pins do not stack), not the plant gates.
// An admin who knows the sites should move them by hand.
const REAL: FactoryInput[] = [
  {
    name: { en: 'Edita Food Industries', ar: 'إديتا للصناعات الغذائية' },
    area: 'oct6-extension',
    sector: 'food',
    location: pin(29.9, 30.88),
    productsMade: [
      p('Cakes and bakery (Molto, HOHOs, Twinkies)', 'كيك ومخبوزات (مولتو، هوهوز، توينكيز)', '1905'),
      p('Wafers and biscuits (Bake Rolz, Tiger Tail)', 'ويفر وبسكويت (بيك رولز، تايجر تيل)', '1905'),
      p('Rusks (Bake Stix)', 'بقسماط (بيك ستيكس)', '1905'),
    ],
    productsNeeded: [],
    contact: { website: 'https://www.edita.com.eg' },
    photos: [],
  },
  {
    name: { en: 'Juhayna Food Industries', ar: 'جهينة للصناعات الغذائية' },
    area: 'oct6-extension',
    sector: 'food',
    location: pin(29.901, 30.8815),
    productsMade: [
      p('Spoonable and drinkable yogurt (Rayeb, Zabado, fruit yogurt)', 'زبادي بالملعقة وللشرب (رايب، زبادو، زبادي بالفاكهة)', '0403'),
    ],
    productsNeeded: [],
    contact: { website: 'https://www.juhayna.com' },
    photos: [],
  },
]

const FICTIONAL: FactoryInput[] = [
  fake({
    name: { en: 'Demo Feed Mills (sample)', ar: 'مصنع أعلاف تجريبي (عينة)' },
    area: 'oct6-zone-1',
    sector: 'animal-feed',
    location: pin(29.9238, 30.9117),
    productsMade: [
      p('Poultry feed', 'علف دواجن', '2309', '230990'),
      p('Cattle feed', 'علف ماشية', '2309', '230990'),
      p('Wheat bran', 'نخالة قمح', '2302'),
    ],
    productsNeeded: [
      p('Yellow maize', 'ذرة صفراء', '1005', '100590'),
      p('Soybean meal', 'كسب فول الصويا', '2304', '230400'),
      p('Polyethylene feed sacks', 'أكياس علف من البولي إيثيلين', '3923', '392321'),
    ],
  }),
  fake({
    name: { en: 'Demo Grain Trading (sample)', ar: 'شركة تجارة حبوب تجريبية (عينة)' },
    area: 'oct6-zone-2',
    sector: 'food',
    location: pin(29.9247, 30.9011),
    productsMade: [
      p('Yellow maize', 'ذرة صفراء', '1005', '100590'),
      p('Soybean meal', 'كسب فول الصويا', '2304', '230400'),
      p('Milling wheat', 'قمح للطحن', '1001'),
    ],
    productsNeeded: [p('Polyethylene sacks', 'أكياس بولي إيثيلين', '3923', '392321')],
  }),
  fake({
    name: { en: 'Demo Packaging Co (sample)', ar: 'مصنع تعبئة وتغليف تجريبي (عينة)' },
    area: 'oct6-zone-3',
    sector: 'plastics-packaging',
    location: pin(29.9185, 30.8915),
    productsMade: [
      p('Polyethylene sacks', 'أكياس بولي إيثيلين', '3923', '392321'),
      p('Plastic crates', 'صناديق بلاستيك', '3923'),
      p('Stretch film', 'فيلم تغليف شد', '3920'),
    ],
    productsNeeded: [p('Polyethylene granules', 'حبيبات بولي إيثيلين', '3901')],
  }),
  fake({
    name: { en: 'Demo Polymers (sample)', ar: 'مصنع بوليمرات تجريبي (عينة)' },
    area: 'oct6-zone-3',
    sector: 'plastics-packaging',
    location: pin(29.9163, 30.8939),
    productsMade: [
      p('Polyethylene granules', 'حبيبات بولي إيثيلين', '3901'),
      p('PVC cable compound', 'مركب بي في سي للكابلات', '3904'),
    ],
    productsNeeded: [
      p('Naphtha feedstock', 'نافثا خام', '2710'),
      p('Polyethylene sacks', 'أكياس بولي إيثيلين', '3923', '392321'),
    ],
  }),
  fake({
    name: { en: 'Demo Cables (sample)', ar: 'مصنع كابلات تجريبي (عينة)' },
    area: 'oct6-zone-4',
    sector: 'electrical-cables',
    location: pin(29.9154, 30.8943),
    productsMade: [
      p('Insulated power cable', 'كابلات كهرباء معزولة', '8544', '854449'),
      p('Building wire', 'أسلاك كهرباء للمباني', '8544'),
    ],
    productsNeeded: [
      p('Copper wire rod', 'سلك نحاس', '7408', '740811'),
      p('PVC cable compound', 'مركب بي في سي للكابلات', '3904'),
    ],
  }),
  fake({
    name: { en: 'Demo Metals Plant (sample)', ar: 'مصنع معادن تجريبي (عينة)' },
    area: 'oct6-zone-5',
    sector: 'metals',
    location: pin(29.9092, 30.8919),
    productsMade: [
      p('Copper wire rod', 'سلك نحاس', '7408', '740811'),
      p('Steel rebar', 'حديد تسليح', '7214'),
    ],
    productsNeeded: [
      p('Copper scrap', 'خردة نحاس', '7404'),
      p('Corrugated cartons', 'كراتين مموجة', '4819'),
    ],
  }),
  fake({
    name: { en: 'Demo Building Materials (sample)', ar: 'مصنع مواد بناء تجريبي (عينة)' },
    area: 'oct6-zone-6',
    sector: 'building-materials',
    location: pin(29.9068, 30.8872),
    productsMade: [
      p('Concrete blocks', 'طوب خرساني', '6810'),
      p('Ceramic floor tiles', 'بلاط سيراميك للأرضيات', '6907'),
    ],
    productsNeeded: [
      p('Steel rebar', 'حديد تسليح', '7214'),
      p('Portland cement', 'أسمنت بورتلاند', '2523'),
    ],
  }),
  fake({
    name: { en: 'Demo Printing and Cartons (sample)', ar: 'مطبعة وكرتون تجريبي (عينة)' },
    area: 'oct6-extension',
    sector: 'paper-printing',
    location: pin(29.8985, 30.8785),
    productsMade: [
      p('Corrugated cartons', 'كراتين مموجة', '4819'),
      p('Printed brochures', 'كتيبات مطبوعة', '4911'),
    ],
    productsNeeded: [
      p('Uncoated paper', 'ورق غير مطلي', '4802'),
      p('Stretch film', 'فيلم تغليف شد', '3920'),
    ],
  }),
]

export const DEMO_FACTORIES: FactoryInput[] = [...REAL, ...FICTIONAL]
