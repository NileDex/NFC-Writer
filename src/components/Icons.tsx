/** Tiny inline SVG icons - no icon library dependency. */

interface IconProps {
  size?: number
  className?: string
}

function svg(props: IconProps, children: React.ReactNode) {
  const { size = 16, className } = props
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export function NfcIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M2.5 5.5a6 6 0 0 1 0 5" />
      <path d="M5 3.5a9 9 0 0 1 0 9" />
      <path d="M7.5 1.5a12 12 0 0 1 0 13" />
      <circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ))
}

export function InfoIcon(props: IconProps) {
  return svg(props, (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5" />
      <circle cx="8" cy="5.1" r="0.6" fill="currentColor" stroke="none" />
    </>
  ))
}

export function WarnIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M8 2 1.75 13.25h12.5L8 2Z" />
      <path d="M8 6.5v3" />
      <circle cx="8" cy="11.4" r="0.6" fill="currentColor" stroke="none" />
    </>
  ))
}

export function ErrorIcon(props: IconProps) {
  return svg(props, (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="m5.75 5.75 4.5 4.5M10.25 5.75l-4.5 4.5" />
    </>
  ))
}

export function SuccessIcon(props: IconProps) {
  return svg(props, (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="m5.25 8.25 1.9 1.9 3.6-4" />
    </>
  ))
}

export function PlugIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M6 1.75v3M10 1.75v3" />
      <path d="M4.25 4.75h7.5v2.5a3.75 3.75 0 0 1-7.5 0v-2.5Z" />
      <path d="M8 11v3.25" />
    </>
  ))
}

export function DownloadIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M8 2.5v7.5" />
      <path d="m4.75 7.25 3.25 3.25 3.25-3.25" />
      <path d="M2.75 13.25h10.5" />
    </>
  ))
}

export function CopyIcon(props: IconProps) {
  return svg(props, (
    <>
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.25" />
      <path d="M10.75 5.25v-1.5a1.25 1.25 0 0 0-1.25-1.25H3.75A1.25 1.25 0 0 0 2.5 3.75v5.75a1.25 1.25 0 0 0 1.25 1.25h1.5" />
    </>
  ))
}

export function CheckIcon(props: IconProps) {
  return svg(props, <path d="m3 8.5 3.25 3.25L13 4.75" />)
}

export function LinkIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M6.75 9.25a2.75 2.75 0 0 0 0 3.9l.6.6a2.75 2.75 0 0 0 3.9 0l2-2a2.75 2.75 0 0 0 0-3.9l-.85-.85" />
      <path d="M9.25 6.75a2.75 2.75 0 0 0 0-3.9l-.6-.6a2.75 2.75 0 0 0-3.9 0l-2 2a2.75 2.75 0 0 0 0 3.9l.85.85" />
    </>
  ))
}

export function TagIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M2.25 7.4V3.25A1 1 0 0 1 3.25 2.25h4.15a1 1 0 0 1 .7.29l6.1 6.1a1 1 0 0 1 0 1.41l-4.15 4.15a1 1 0 0 1-1.41 0l-6.1-6.1a1 1 0 0 1-.29-.7Z" />
      <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ))
}

export function ChipIcon(props: IconProps) {
  return svg(props, (
    <>
      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1" />
      <path d="M6.5 1.75v2.5M9.5 1.75v2.5M6.5 11.75v2.5M9.5 11.75v2.5M1.75 6.5h2.5M1.75 9.5h2.5M11.75 6.5h2.5M11.75 9.5h2.5" />
    </>
  ))
}

export function PenIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M11.4 2.6a1.4 1.4 0 0 1 2 2l-7.6 7.6-2.7.7.7-2.7Z" />
      <path d="m10.2 3.8 2 2" />
      <path d="M2.5 13.75h11" />
    </>
  ))
}

export function EyeIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M1.5 8S4 3.75 8 3.75 14.5 8 14.5 8 12 12.25 8 12.25 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="1.9" />
    </>
  ))
}

export function BoltIcon(props: IconProps) {
  return svg(props, <path d="M9.25 1.75 3.75 9h3.4l-.65 5.25L11.75 7H8.25Z" />)
}

export function CodeIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M5.25 4.5 2.5 8l2.75 3.5" />
      <path d="M10.75 4.5 13.5 8l-2.75 3.5" />
      <path d="m9.4 2.75-2.8 10.5" />
    </>
  ))
}

export function SlidersIcon(props: IconProps) {
  return svg(props, (
    <>
      <path d="M2.5 5.25h1.5M7.75 5.25h5.75M2.5 10.75h5.25M11.25 10.75h2.25" />
      <circle cx="5.75" cy="5.25" r="1.75" />
      <circle cx="10.25" cy="10.75" r="1.75" />
    </>
  ))
}

export function HelpIcon(props: IconProps) {
  return svg(props, (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.3 6.2a1.75 1.75 0 1 1 2.35 1.64c-.42.17-.65.55-.65.98v.43" />
      <circle cx="8" cy="11.35" r="0.6" fill="currentColor" stroke="none" />
    </>
  ))
}
