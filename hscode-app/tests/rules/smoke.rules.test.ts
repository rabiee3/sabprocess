import { assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc } from 'firebase/firestore'
import { asAdmin, asVisitor } from './helpers'

it('denies a visitor reading a users doc', async () => {
  await assertFails(getDoc(doc(asVisitor(), 'users/anyone')))
})

it('allows the admin context to be created', async () => {
  expect(asAdmin()).toBeTruthy()
})
