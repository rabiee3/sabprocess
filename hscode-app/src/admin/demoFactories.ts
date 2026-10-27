import { areas } from '../data'
import type { Product } from '../lib/types'
import type { FactoryInput } from '../survey/types'

/**
 * Bundled demo data for the admin Dashboard's "Load demo factories" button. Every entry is created
 * with `sample: true`; the English name is the stable key that makes loading idempotent.
 *
 * Two real companies (public information only, see docs/hscode/sample-factories.md) plus clearly
 * fictional ones: eight general ones and a starch and glucose value chain (mills, derivatives, buyers,
 * suppliers) for demos to that industry. No phone numbers or other contact details anywhere, except the websites
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

// Starch chain pins: spread on a spiral around the area centre (about 0.4-1.5 km out), so none stack.
const placed = new Map<string, number>()
const around = (area: string) => {
  const k = placed.get(area) ?? 0
  placed.set(area, k + 1)
  const c = areas().find((a) => a.id === area)!.center
  const r = 0.004 + 0.0025 * Math.sqrt(k)
  const t = k * 2.39996
  return pin(+(c.lat + r * Math.sin(t)).toFixed(5), +(c.lng + r * Math.cos(t)).toFixed(5))
}
type Chain = Omit<FactoryInput, 'contact' | 'photos' | 'location'>
const chain = (f: Chain): FactoryInput => fake({ ...f, location: around(f.area) })

// Shared products, so buyers and suppliers read the same.
const MAIZE = p('Yellow maize', 'ذرة صفراء', '1005', '100590')
const MAIZE_STARCH = p('Native maize starch', 'نشا ذرة طبيعي', '1108', '110812')
const POTATO_STARCH = p('Potato starch', 'نشا البطاطس', '1108', '110813')
const GLUCOSE = p('Glucose syrup', 'شراب الجلوكوز', '1702', '170230')
const DEXTROSE = p('Dextrose monohydrate', 'دكستروز أحادي الهيدرات', '1702', '170230')
const PHARMA_DEXTROSE = p('Pharma-grade dextrose', 'دكستروز بدرجة دوائية', '1702', '170230')
const MALTO = p('Maltodextrin', 'مالتودكسترين', '1702', '170290')
const HFCS = p('High-fructose syrup', 'شراب الذرة عالي الفركتوز', '1702', '170260')
const MOD_STARCH = p('Modified food starch', 'نشا معدل غذائي', '3505', '350510')
const CATIONIC = p('Cationic starch for paper', 'نشا كاتيوني للورق', '3505', '350510')
const STARCH_GLUE = p('Starch-based corrugating adhesive', 'غراء نشوي للكرتون المموج', '3505', '350520')
const GLUTEN = p('Vital wheat gluten', 'جلوتين القمح', '1109', '110900')
const GLUTEN_FEED = p('Corn gluten feed', 'علف جلوتين الذرة', '2303', '230310')
const CORN_OIL = p('Crude maize germ oil', 'زيت جنين الذرة الخام', '1515', '151521')
const SORBITOL = p('Sorbitol solution 70%', 'محلول سوربيتول ٧٠٪', '2905', '290544')
const ENZYMES = p('Starch enzymes (amylase)', 'إنزيمات النشا (أميليز)', '3507', '350790')
const CAUSTIC = p('Caustic soda', 'صودا كاوية', '2815', '281511')
const HCL = p('Hydrochloric acid', 'حمض الهيدروكلوريك', '2806', '280610')
const CARBON = p('Activated carbon', 'كربون منشط', '3802', '380210')
const WOVEN_SACKS = p('Woven polypropylene sacks', 'أجولة بولي بروبيلين منسوجة', '6305', '630533')
const SUGAR = p('White sugar', 'سكر أبيض', '1701')
const CARTONS = p('Corrugated cartons', 'كراتين مموجة', '4819', '481910')
const FLUTING = p('Fluting paper', 'ورق تمويج', '4805', '480519')

const STARCH_CHAIN: FactoryInput[] = [
  // Starch mills
  chain({
    name: { en: 'Demo Nile Maize Starch (sample)', ar: 'مصنع النيل لنشا الذرة التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'food',
    productsMade: [MAIZE_STARCH, GLUCOSE, GLUTEN_FEED, CORN_OIL],
    productsNeeded: [MAIZE, ENZYMES, CAUSTIC],
  }),
  chain({
    name: { en: 'Demo Delta Starch and Glucose (sample)', ar: 'شركة الدلتا للنشا والجلوكوز التجريبية (عينة)' },
    area: 'sadat-city',
    sector: 'food',
    productsMade: [MAIZE_STARCH, DEXTROSE, GLUTEN_FEED],
    productsNeeded: [MAIZE, HCL, CARBON],
  }),
  chain({
    name: { en: 'Demo Sadat Wet Milling (sample)', ar: 'مطحن السادات للطحن الرطب التجريبي (عينة)' },
    area: 'sadat-city',
    sector: 'food',
    productsMade: [MAIZE_STARCH, MOD_STARCH, CORN_OIL],
    productsNeeded: [MAIZE, WOVEN_SACKS],
  }),
  chain({
    name: { en: 'Demo Obour Wheat Starch (sample)', ar: 'مصنع العبور لنشا القمح التجريبي (عينة)' },
    area: 'obour',
    sector: 'food',
    productsMade: [p('Wheat starch', 'نشا القمح', '1108', '110811'), GLUTEN, GLUCOSE],
    productsNeeded: [p('Milling wheat', 'قمح للطحن', '1001'), ENZYMES],
  }),
  chain({
    name: { en: 'Demo Potato Starch Works (sample)', ar: 'مصنع نشا البطاطس التجريبي (عينة)' },
    area: 'borg-el-arab',
    sector: 'food',
    productsMade: [POTATO_STARCH, p('Potato pulp for feed', 'لب البطاطس للأعلاف', '2303', '230310')],
    productsNeeded: [p('Starch potatoes', 'بطاطس للنشا', '0701'), WOVEN_SACKS],
  }),
  chain({
    name: { en: 'Demo Borg Starch Mill (sample)', ar: 'مطحن برج العرب للنشا التجريبي (عينة)' },
    area: 'borg-el-arab',
    sector: 'food',
    productsMade: [MAIZE_STARCH, GLUCOSE, GLUTEN_FEED],
    productsNeeded: [MAIZE, CAUSTIC],
  }),
  chain({
    name: { en: 'Demo Ramadan Corn Products (sample)', ar: 'شركة رمضان لمنتجات الذرة التجريبية (عينة)' },
    area: '10th-ramadan',
    sector: 'food',
    productsMade: [MAIZE_STARCH, MOD_STARCH, MALTO],
    productsNeeded: [MAIZE, ENZYMES],
  }),
  chain({
    name: { en: 'Demo Specialty Starch Traders (sample)', ar: 'شركة تجارة النشويات الخاصة التجريبية (عينة)' },
    area: 'oct6-zone-2',
    sector: 'food',
    productsMade: [p('Tapioca (cassava) starch', 'نشا التابيوكا (الكسافا)', '1108', '110814'), p('Rice starch', 'نشا الأرز', '1108', '110819')],
    productsNeeded: [p('Polyethylene sacks', 'أكياس بولي إيثيلين', '3923', '392321')],
  }),
  chain({
    name: { en: 'Demo October Starch (sample)', ar: 'مصنع أكتوبر للنشا التجريبي (عينة)' },
    area: 'oct6-zone-1',
    sector: 'food',
    productsMade: [MAIZE_STARCH, GLUTEN_FEED],
    productsNeeded: [MAIZE, WOVEN_SACKS],
  }),
  chain({
    name: { en: 'Demo Obour Starch Blends (sample)', ar: 'مصنع العبور لخلطات النشا التجريبي (عينة)' },
    area: 'obour',
    sector: 'food',
    productsMade: [p('Custom starch blends', 'خلطات نشا حسب الطلب', '1108', '110819'), p('Pregelatinised starch', 'نشا مُجلتن مسبقاً', '3505', '350510')],
    productsNeeded: [MAIZE_STARCH, ENZYMES],
  }),

  // Glucose and other derivatives
  chain({
    name: { en: 'Demo Glucose Syrups (sample)', ar: 'مصنع شراب الجلوكوز التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'food',
    productsMade: [GLUCOSE, p('High-maltose syrup', 'شراب عالي المالتوز', '1702', '170290'), HFCS],
    productsNeeded: [MAIZE_STARCH, ENZYMES, CARBON],
  }),
  chain({
    name: { en: 'Demo Pharma Dextrose (sample)', ar: 'مصنع الدكستروز الدوائي التجريبي (عينة)' },
    area: 'sadat-city',
    sector: 'chemicals',
    productsMade: [PHARMA_DEXTROSE, p('Anhydrous dextrose', 'دكستروز لا مائي', '1702', '170230')],
    productsNeeded: [MAIZE_STARCH, CARBON],
  }),
  chain({
    name: { en: 'Demo Maltodextrin Co (sample)', ar: 'شركة المالتودكسترين التجريبية (عينة)' },
    area: 'obour',
    sector: 'food',
    productsMade: [MALTO, p('Spray-dried glucose syrup', 'شراب جلوكوز مجفف بالرذاذ', '1702', '170230')],
    productsNeeded: [MAIZE_STARCH, ENZYMES],
  }),
  chain({
    name: { en: 'Demo Sorbitol Chemicals (sample)', ar: 'مصنع السوربيتول للكيماويات التجريبي (عينة)' },
    area: 'borg-el-arab',
    sector: 'chemicals',
    productsMade: [SORBITOL, p('Sorbitol powder', 'سوربيتول بودرة', '2905', '290544')],
    productsNeeded: [DEXTROSE, CARBON],
  }),
  chain({
    name: { en: 'Demo Modified Starches (sample)', ar: 'مصنع النشا المعدل التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'chemicals',
    productsMade: [CATIONIC, p('Oxidised starch', 'نشا مؤكسد', '3505', '350510'), STARCH_GLUE],
    productsNeeded: [MAIZE_STARCH, CAUSTIC],
  }),
  chain({
    name: { en: 'Demo Starch Adhesives (sample)', ar: 'مصنع المواد اللاصقة النشوية التجريبي (عينة)' },
    area: 'oct6-zone-4',
    sector: 'chemicals',
    productsMade: [STARCH_GLUE, p('Dextrin glue for bags and labels', 'غراء دكسترين للأكياس والملصقات', '3505', '350520')],
    productsNeeded: [MAIZE_STARCH, CAUSTIC],
  }),
  chain({
    name: { en: 'Demo HFCS Sweeteners (sample)', ar: 'مصنع المحليات عالية الفركتوز التجريبي (عينة)' },
    area: 'sadat-city',
    sector: 'food',
    productsMade: [HFCS, p('Glucose-fructose syrup', 'شراب الجلوكوز والفركتوز', '1702', '170240')],
    productsNeeded: [MAIZE_STARCH, ENZYMES],
  }),
  chain({
    name: { en: 'Demo Sugar Syrups (sample)', ar: 'مصنع الشراب السكري التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'food',
    productsMade: [p('Invert sugar syrup', 'شراب السكر المحول', '1702', '170290'), p('Blended table syrup', 'شراب مائدة مخلوط', '1702', '170240')],
    productsNeeded: [SUGAR, GLUCOSE],
  }),

  // Buyers
  chain({
    name: { en: 'Demo Sweets and Candy (sample)', ar: 'مصنع الحلوى والسكاكر التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'food',
    productsMade: [p('Hard candy', 'حلوى صلبة', '1704', '170490'), p('Toffee', 'توفي', '1704', '170490'), p('Fruit jelly sweets', 'حلوى جيلي بالفاكهة', '1704', '170490')],
    productsNeeded: [GLUCOSE, SUGAR, CARTONS],
  }),
  chain({
    name: { en: 'Demo Chocolate and Wafers (sample)', ar: 'مصنع الشوكولاتة والويفر التجريبي (عينة)' },
    area: 'obour',
    sector: 'food',
    productsMade: [p('Chocolate bars', 'ألواح شوكولاتة', '1806'), p('Chocolate-coated wafers', 'ويفر مغطى بالشوكولاتة', '1905', '190590')],
    productsNeeded: [GLUCOSE, SUGAR, CARTONS],
  }),
  chain({
    name: { en: 'Demo Biscuits (sample)', ar: 'مصنع البسكويت التجريبي (عينة)' },
    area: 'oct6-zone-2',
    sector: 'food',
    productsMade: [p('Sweet biscuits', 'بسكويت حلو', '1905', '190590'), p('Sponge cakes', 'كيك إسفنجي', '1905', '190590')],
    productsNeeded: [GLUCOSE, MOD_STARCH, CARTONS],
  }),
  chain({
    name: { en: 'Demo Soft Drinks (sample)', ar: 'مصنع المشروبات الغازية التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'food',
    productsMade: [p('Carbonated soft drinks', 'مشروبات غازية', '2202', '220299'), p('Flavoured water drinks', 'مياه منكهة', '2202', '220299')],
    productsNeeded: [HFCS, p('PET bottle preforms', 'قوالب زجاجات PET', '3923', '392330')],
  }),
  chain({
    name: { en: 'Demo Juices and Nectars (sample)', ar: 'مصنع العصائر والنكتار التجريبي (عينة)' },
    area: 'sadat-city',
    sector: 'food',
    productsMade: [p('Fruit nectars', 'نكتار فواكه', '2202', '220299'), p('Mango juice', 'عصير مانجو', '2009')],
    productsNeeded: [GLUCOSE, CARTONS],
  }),
  chain({
    name: { en: 'Demo Ice Cream (sample)', ar: 'مصنع الآيس كريم التجريبي (عينة)' },
    area: 'obour',
    sector: 'food',
    productsMade: [p('Ice cream', 'آيس كريم', '2105', '210500'), p('Ice lollies', 'مثلجات على عصا', '2105', '210500')],
    productsNeeded: [GLUCOSE, MALTO, CARTONS],
  }),
  chain({
    name: { en: 'Demo Jams and Fillings (sample)', ar: 'مصنع المربى والحشوات التجريبي (عينة)' },
    area: 'borg-el-arab',
    sector: 'food',
    productsMade: [p('Fruit jams', 'مربى فواكه', '2007', '200799'), p('Bakery fruit fillings', 'حشوات فواكه للمخابز', '2007', '200799')],
    productsNeeded: [GLUCOSE, SUGAR, MOD_STARCH],
  }),
  chain({
    name: { en: 'Demo Pharma Tablets (sample)', ar: 'مصنع الأقراص الدوائية التجريبي (عينة)' },
    area: 'oct6-zone-5',
    sector: 'chemicals',
    productsMade: [p('Tablets and capsules', 'أقراص وكبسولات', '3004', '300490'), p('Cough syrups', 'شراب للكحة', '3004', '300490')],
    productsNeeded: [DEXTROSE, MAIZE_STARCH, SORBITOL],
  }),
  chain({
    name: { en: 'Demo IV Solutions (sample)', ar: 'مصنع المحاليل الوريدية التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'chemicals',
    productsMade: [p('Dextrose infusion 5%', 'محلول دكستروز ٥٪ للحقن', '3004', '300490'), p('Saline-dextrose infusion', 'محلول ملحي بالدكستروز', '3004', '300490')],
    productsNeeded: [PHARMA_DEXTROSE],
  }),
  chain({
    name: { en: 'Demo Toothpaste and Cosmetics (sample)', ar: 'مصنع معجون الأسنان ومستحضرات التجميل التجريبي (عينة)' },
    area: 'obour',
    sector: 'chemicals',
    productsMade: [p('Toothpaste', 'معجون أسنان', '3306'), p('Moisturising creams', 'كريمات مرطبة', '3304', '330499')],
    productsNeeded: [SORBITOL, CARTONS],
  }),
  chain({
    name: { en: 'Demo Paper Mill (sample)', ar: 'مصنع الورق التجريبي (عينة)' },
    area: 'borg-el-arab',
    sector: 'paper-printing',
    productsMade: [p('Printing and writing paper', 'ورق طباعة وكتابة', '4802', '480256'), FLUTING],
    productsNeeded: [CATIONIC, MAIZE_STARCH, CAUSTIC],
  }),
  chain({
    name: { en: 'Demo Corrugated Boxes (sample)', ar: 'مصنع الكرتون المموج التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'paper-printing',
    productsMade: [CARTONS, p('Corrugated board sheets', 'ألواح كرتون مموج', '4808')],
    productsNeeded: [FLUTING, STARCH_GLUE],
  }),
  chain({
    name: { en: 'Demo Cotton Weaving (sample)', ar: 'مصنع نسيج القطن التجريبي (عينة)' },
    area: 'sadat-city',
    sector: 'textiles',
    productsMade: [p('Cotton denim fabric', 'قماش دنيم قطني', '5209', '520942'), p('Cotton yarn', 'غزل قطني', '5205')],
    productsNeeded: [MAIZE_STARCH, MOD_STARCH],
  }),
  chain({
    name: { en: 'Demo Sadat Feed Mills (sample)', ar: 'مصنع أعلاف السادات التجريبي (عينة)' },
    area: 'sadat-city',
    sector: 'animal-feed',
    productsMade: [p('Poultry feed', 'علف دواجن', '2309', '230990'), p('Fish feed', 'علف أسماك', '2309', '230990')],
    productsNeeded: [GLUTEN_FEED, MAIZE, p('Soybean meal', 'كسب فول الصويا', '2304', '230400')],
  }),
  chain({
    name: { en: 'Demo Infant Cereals (sample)', ar: 'مصنع حبوب الأطفال التجريبي (عينة)' },
    area: 'oct6-zone-6',
    sector: 'food',
    productsMade: [p('Infant cereals', 'حبوب للأطفال', '1901'), p('Custard powder', 'بودرة كاسترد', '2106', '210690')],
    productsNeeded: [MAIZE_STARCH, MALTO],
  }),
  chain({
    name: { en: 'Demo Bakery Ingredients (sample)', ar: 'مصنع مستلزمات المخابز التجريبي (عينة)' },
    area: 'obour',
    sector: 'food',
    productsMade: [p('Bread improver', 'محسن خبز', '2106', '210690'), p('Baking powder', 'بيكنج بودر', '2102')],
    productsNeeded: [GLUTEN, MAIZE_STARCH, ENZYMES],
  }),
  chain({
    name: { en: 'Demo Snacks and Chips (sample)', ar: 'مصنع الشيبسي والسناكس التجريبي (عينة)' },
    area: '10th-ramadan',
    sector: 'food',
    productsMade: [p('Potato chips', 'شيبسي بطاطس', '2005'), p('Puffed corn snacks', 'سناكس ذرة منفوخة', '1904')],
    productsNeeded: [MOD_STARCH, POTATO_STARCH],
  }),

  // Suppliers
  chain({
    name: { en: 'Demo Maize Importers (sample)', ar: 'شركة استيراد الذرة التجريبية (عينة)' },
    area: 'borg-el-arab',
    sector: 'food',
    productsMade: [MAIZE, p('White maize', 'ذرة بيضاء', '1005', '100590')],
    productsNeeded: [WOVEN_SACKS],
  }),
  chain({
    name: { en: 'Demo Enzymes and Process Aids (sample)', ar: 'شركة الإنزيمات ومساعدات التصنيع التجريبية (عينة)' },
    area: 'oct6-zone-1',
    sector: 'chemicals',
    productsMade: [ENZYMES, p('Glucoamylase enzyme', 'إنزيم جلوكوأميليز', '3507', '350790'), CARBON],
    productsNeeded: [CARTONS],
  }),
  chain({
    name: { en: 'Demo Chemicals Distributor (sample)', ar: 'شركة توزيع الكيماويات التجريبية (عينة)' },
    area: '10th-ramadan',
    sector: 'chemicals',
    productsMade: [CAUSTIC, HCL, CARBON],
    productsNeeded: [p('Plastic drums and IBC tanks', 'براميل وخزانات بلاستيكية', '3923')],
  }),
  chain({
    name: { en: 'Demo Sugar Refinery (sample)', ar: 'معمل تكرير السكر التجريبي (عينة)' },
    area: 'borg-el-arab',
    sector: 'food',
    productsMade: [SUGAR, p('Cane molasses', 'مولاس قصب', '1703')],
    productsNeeded: [WOVEN_SACKS, CARBON],
  }),
  chain({
    name: { en: 'Demo Woven Sacks (sample)', ar: 'مصنع الأجولة المنسوجة التجريبي (عينة)' },
    area: 'obour',
    sector: 'plastics-packaging',
    productsMade: [WOVEN_SACKS, p('Jumbo bags (FIBC)', 'أجولة جامبو', '6305', '630532')],
    productsNeeded: [p('Polyethylene granules', 'حبيبات بولي إيثيلين', '3901')],
  }),
]

export const DEMO_FACTORIES: FactoryInput[] = [...REAL, ...FICTIONAL, ...STARCH_CHAIN]
