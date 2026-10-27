import { UpdateBanner } from '../pwa/UpdateBanner'
import { SignOutKeptBanner } from './SignOutKeptBanner'

/**
 * The floating notes under the header, in one fixed column so they stack instead of covering each other:
 * "Update available" first, then "signed out, your unsynced data was kept". Rendered once, outside the router,
 * so both show on every route (error pages included) and the kept note outlives the header that signed out.
 */
export function FloatingBanners() {
  return (
    <div className="pointer-events-none fixed inset-x-2 top-14 z-[1300] flex flex-col gap-2 lg:end-2 lg:start-auto lg:w-96 [&>*]:pointer-events-auto">
      <UpdateBanner />
      <SignOutKeptBanner />
    </div>
  )
}
