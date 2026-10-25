import { useEffect, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isSafeImage } from '../admin/safeImage'

// One factory-doc read per id per session, shared by every card.
const cache = new Map<string, Promise<string | null>>()

function fetchThumb(id: string): Promise<string | null> {
  let p = cache.get(id)
  if (!p) {
    p = getDoc(doc(db, 'factories', id)).then(
      (snap) => {
        const thumb = snap.exists() ? (snap.data() as { thumb?: string }).thumb : undefined
        return isSafeImage(thumb) ? thumb : null
      },
      () => {
        cache.delete(id) // a failed read may be retried next time
        return null
      },
    )
    cache.set(id, p)
  }
  return p
}

/** Loads the card thumbnail only once the element scrolls into view. */
export function useThumb<T extends Element>(id: string) {
  const ref = useRef<T>(null)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const load = () => {
      void fetchThumb(id).then((t) => {
        if (live) setSrc(t)
      })
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      load()
      return () => {
        live = false
      }
    }
    const io = new IntersectionObserver((hits) => {
      if (hits.some((h) => h.isIntersecting)) {
        io.disconnect()
        load()
      }
    })
    io.observe(el)
    return () => {
      live = false
      io.disconnect()
    }
  }, [id])

  return { ref, src }
}
