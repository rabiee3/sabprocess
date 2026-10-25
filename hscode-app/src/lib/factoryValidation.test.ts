import { describe, expect, it } from 'vitest'
import { LIMITS, tooLong, validateFactoryFields, type FieldsToValidate } from './factoryValidation'

const ok: FieldsToValidate = {
  name: { en: 'Nile Plastics' },
  area: 'oct6-zone-1',
  productsMade: [{ name: { en: 'Pipes' } }],
  productsNeeded: [],
  contact: {},
}

describe('validateFactoryFields', () => {
  it('accepts valid fields', () => expect(validateFactoryFields(ok)).toEqual([]))
  it('requires a name and an area', () => {
    expect(validateFactoryFields({ ...ok, name: { en: ' ' }, area: '' })).toEqual([
      'survey.basics.nameRequired',
      'survey.basics.areaRequired',
    ])
  })
  it('requires areaOther when the area is other', () => {
    expect(validateFactoryFields({ ...ok, area: 'other' })).toEqual(['survey.basics.areaOtherRequired'])
  })
  it('flags too-long fields, products without a name and bad HS', () => {
    const long = 'x'.repeat(LIMITS.address + 1)
    const errs = validateFactoryFields({
      ...ok,
      address: long,
      productsMade: [{ name: {} }, { name: { en: 'a' }, hs: { heading: '12', tariff: 'zz' } }],
      contact: { phone: 'y'.repeat(41) },
    })
    expect(errs).toEqual(
      expect.arrayContaining([tooLong('address'), tooLong('phone'), 'survey.products.nameRequired', 'hs.tariffInvalid']),
    )
  })
})
