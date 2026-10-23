import { NTAG213_USER_BYTES } from '../lib/ndef'
import type { PayloadBuild } from '../lib/payload'

interface PayloadMeterProps {
  build: PayloadBuild
}

/** Byte-usage bar + human-readable preview of what will be written. */
export function PayloadMeter({ build }: PayloadMeterProps) {
  const used = build.bytesUsed ?? 0
  const capacity = NTAG213_USER_BYTES
  const remaining = build.remaining ?? capacity
  const percent = Math.min(100, Math.round((used / capacity) * 100))

  return (
    <div className="payload-meter">
      <div className="payload-meter__row">
        <span className="label-caps">Payload</span>
        <span className="mono payload-meter__count">
          {used} / {capacity} bytes
        </span>
      </div>
      <div
        className="progress"
        role="meter"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label="Payload size"
      >
        <div
          className={`progress__bar${build.tooLarge ? ' progress__bar--accent' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="field__hint">
        {build.tooLarge
          ? `Overflows NTAG213 by ${Math.abs(remaining)} bytes`
          : `${remaining} bytes left on an NTAG213`}
      </p>
      {build.preview && (
        <p className="payload-meter__preview">
          <span className="label-caps">Preview</span>
          <span className="mono">{build.preview}</span>
        </p>
      )}
    </div>
  )
}
