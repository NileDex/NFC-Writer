import { DEVICE_KINDS, type DeviceKindId } from '../lib/devices'
import { setDeviceKind, useDeviceKind } from '../hooks/useDeviceKind'
import { ChipIcon, NfcIcon } from './Icons'

const KIND_ICONS: Partial<
  Record<DeviceKindId, (props: { size?: number }) => React.ReactElement>
> = {
  microcontroller: ChipIcon,
  phone: NfcIcon,
}

/** Segmented writer-device selector - see lib/devices.ts for the options. */
export function DevicePicker() {
  const active = useDeviceKind()
  return (
    <div className="seg device-picker" role="group" aria-label="Writer device">
      {DEVICE_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind.id]
        return (
          <button
            key={kind.id}
            type="button"
            aria-pressed={active === kind.id}
            title={kind.detail}
            onClick={() => setDeviceKind(kind.id)}
          >
            {Icon && <Icon size={14} />}
            {kind.label}
          </button>
        )
      })}
    </div>
  )
}
