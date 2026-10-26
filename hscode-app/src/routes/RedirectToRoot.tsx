import { Navigate, useLocation } from 'react-router'

/** Old /map links land on the root map with their query string and hash intact. */
export function Component() {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: '/', search, hash }} replace />
}
