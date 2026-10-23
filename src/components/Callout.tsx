import { ErrorIcon, InfoIcon, SuccessIcon, WarnIcon } from './Icons'

export type CalloutKind = 'info' | 'warn' | 'error' | 'success'

const ICONS: Record<CalloutKind, (props: { size?: number }) => React.ReactElement> = {
  info: InfoIcon,
  warn: WarnIcon,
  error: ErrorIcon,
  success: SuccessIcon,
}

interface CalloutProps {
  kind?: CalloutKind
  children: React.ReactNode
}

export function Callout({ kind = 'info', children }: CalloutProps) {
  const Icon = ICONS[kind]
  return (
    <div className={`callout callout--${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <span className="callout__icon">
        <Icon size={16} />
      </span>
      <div>{children}</div>
    </div>
  )
}
