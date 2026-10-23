import { useEffect, useRef } from 'react'

export type LogKind = 'info' | 'ok' | 'err' | 'dim'

export interface LogLine {
  id: number
  text: string
  kind: LogKind
}

interface LogPanelProps {
  lines: LogLine[]
  label?: string
}

export function LogPanel({ lines, label = 'Device log' }: LogPanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div className="log-panel" ref={ref} role="log" aria-label={label}>
      {lines.length === 0 ? (
        <span className="log-panel__line--dim">No activity yet.</span>
      ) : (
        lines.map((line) => (
          <div
            key={line.id}
            className={line.kind === 'info' ? undefined : `log-panel__line--${line.kind}`}
          >
            {line.text}
          </div>
        ))
      )}
    </div>
  )
}
