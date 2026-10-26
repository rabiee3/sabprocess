/** Decorative inline SVG (imported with `?raw`), forced to fill its sized box. */
export function Icon({ svg, className }: { svg: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={'inline-flex shrink-0 items-center justify-center [&>svg]:size-full ' + (className ?? 'size-4')}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
