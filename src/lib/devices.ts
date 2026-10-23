/** Writer-device registry - add a new entry here to grow the picker. */

export type DeviceKindId = 'microcontroller' | 'phone'

export interface DeviceKind {
  id: DeviceKindId
  /** Shown in the picker. */
  label: string
  /** One-line description (tooltip / detail copy). */
  detail: string
}

export const DEVICE_KINDS: readonly DeviceKind[] = [
  {
    id: 'microcontroller',
    label: 'Microcontroller',
    detail: 'ESP32 (or similar) over USB serial',
  },
  {
    id: 'phone',
    label: 'Android / iOS',
    detail: 'Phone with NFC hardware',
  },
]

export const DEFAULT_DEVICE_KIND: DeviceKindId = 'microcontroller'

export function isDeviceKind(value: string): value is DeviceKindId {
  return DEVICE_KINDS.some((kind) => kind.id === value)
}
