import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  query,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Surveyor } from './types'

function toSurveyor(s: QueryDocumentSnapshot<DocumentData>): Surveyor {
  const d = s.data({ serverTimestamps: 'estimate' })
  const created = d.createdAt as { toDate?: () => Date } | undefined
  return {
    uid: s.id,
    name: typeof d.name === 'string' ? d.name : '',
    email: typeof d.email === 'string' ? d.email : '',
    active: d.active === true,
    ...(typeof d.inviteCode === 'string' ? { inviteCode: d.inviteCode } : {}),
    createdAt: created?.toDate?.() ?? new Date(0),
  }
}

/** Live surveyors (users with role == 'surveyor'), newest first. */
export function subscribeSurveyors(
  cb: (rows: Surveyor[]) => void,
  onError: (e: unknown) => void,
  fs: Firestore = db,
): Unsubscribe {
  return onSnapshot(
    query(collection(fs, 'users'), where('role', '==', 'surveyor')),
    (snap) => cb(snap.docs.map(toSurveyor).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
    onError,
  )
}

export async function setSurveyorActive(uid: string, active: boolean, fs: Firestore = db): Promise<void> {
  await updateDoc(doc(fs, 'users', uid), { active })
}

export type SubmissionCounts = { pending: number; approved: number; rejected: number }

export async function countSubmissions(uid: string, fs: Firestore = db): Promise<SubmissionCounts> {
  const one = async (status: keyof SubmissionCounts) =>
    (
      await getCountFromServer(
        query(collection(fs, 'factories'), where('createdBy', '==', uid), where('status', '==', status)),
      )
    ).data().count
  const [pending, approved, rejected] = await Promise.all([one('pending'), one('approved'), one('rejected')])
  return { pending, approved, rejected }
}
