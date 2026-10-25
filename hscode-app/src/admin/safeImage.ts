const SAFE = /^data:image\/(jpeg|png|webp);base64,/

/** Photos and thumbs are inline data URLs; anything else (an https URL, javascript:) is never rendered as an image. */
export const isSafeImage = (src: string | undefined): src is string => !!src && SAFE.test(src)
