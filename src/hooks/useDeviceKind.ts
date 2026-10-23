import { useSyncExternalStore } from 'react'
import { DEFAULT_DEVICE_KIND, isDeviceKind, type DeviceKindId } from '../lib/devices'

const STORAGE_KEY = 'nfc-writer:device-kind'

let cached: DeviceKindId = readStored()
const listeners = new Set<() => void>()

function readStored(): DeviceKindId {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (value !== null && isDeviceKind(value)) return value
  } catch {
    // Private mode or SSR - fall through to the default.
  }
  return DEFAULT_DEVICE_KIND
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): DeviceKindId {
  return cached
}

function getServerSnapshot(): DeviceKindId {
  return DEFAULT_DEVICE_KIND
}

export function setDeviceKind(id: DeviceKindId): void {
  if (id === cached) return
  cached = id
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id)
  } catch {
    // Selection still applies for this session.
  }
  for (const listener of listeners) listener()
}

/** Shared, persisted writer-device selection (Write + Read pages). */
export function useDeviceKind(): DeviceKindId {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
