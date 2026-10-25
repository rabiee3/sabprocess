export function Logo({ variant = 'light', className }: { variant?: 'light' | 'dark'; className?: string }) {
  const dark = variant === 'dark'
  return (
    <span dir="ltr" className={`inline-flex rounded ${className ? 'w-full' : ''}`}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 90 30"
      width="120"
      height="40"
      className={className}
      role="img"
      aria-label="HSCode"
    >
      <g>
        <path
          d="M3 1h21.8a2.6 2.6 0 0 1 2.1 1.05l7.6 10.75a3.6 3.6 0 0 1 0 4.4l-7.6 10.75a2.6 2.6 0 0 1-2.1 1.05H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z"
          fill="#ffc53d"
        />
        <circle cx="29" cy="15" r="2.1" fill={dark ? '#1f2224' : '#ffffff'} stroke={dark ? '#ffffff' : '#1f2224'} strokeWidth={dark ? 1 : 1.4} />
        <text
          x="13.2"
          y="20.6"
          textAnchor="middle"
          fontFamily="IBM Plex Sans, Arial, sans-serif"
          fontSize="15.5"
          fontWeight="700"
          letterSpacing="-0.6"
          fill="#1f2224"
        >
          HS
        </text>
      </g>
      <text
        x="37"
        y="22.5"
        fontFamily="IBM Plex Sans, Arial, sans-serif"
        fontSize="25"
        fontWeight="600"
        letterSpacing="-1.1"
        fill={dark ? '#ffffff' : '#1f2224'}
      >
        code
      </text>
    </svg>
    </span>
  )
}

