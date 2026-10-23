import { useMemo, useState } from 'react'
import type { WifiSecurity } from '../lib/ndef'
import {
  buildPayload,
  type PayloadBuild,
  type RecordInput,
  type RecordType,
} from '../lib/payload'

export interface RecordFormState {
  type: RecordType
  url: string
  text: string
  ssid: string
  password: string
  security: WifiSecurity
  number: string
  email: string
}

const INITIAL: RecordFormState = {
  type: 'url',
  url: '',
  text: '',
  ssid: '',
  password: '',
  security: 'wpa',
  number: '',
  email: '',
}

export interface RecordFormController {
  state: RecordFormState
  setType: (type: RecordType) => void
  set: <K extends keyof RecordFormState>(key: K, value: RecordFormState[K]) => void
  touch: (field: string) => void
  input: RecordInput
  build: PayloadBuild
  errorFor: (field: string) => string | undefined
}

/** Shared Writer/Generator form state: values + live NDEF build. */
export function useRecordForm(): RecordFormController {
  const [state, setState] = useState<RecordFormState>(INITIAL)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const setType = (type: RecordType) => setState((prev) => ({ ...prev, type }))
  const set = <K extends keyof RecordFormState>(key: K, value: RecordFormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))
  const touch = (field: string) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))

  const input = useMemo<RecordInput>(() => {
    switch (state.type) {
      case 'url':
        return { type: 'url', url: state.url }
      case 'text':
        return { type: 'text', text: state.text }
      case 'wifi':
        return { type: 'wifi', ssid: state.ssid, password: state.password, security: state.security }
      case 'phone':
        return { type: 'phone', number: state.number }
      case 'email':
        return { type: 'email', email: state.email }
    }
  }, [state])

  const build = useMemo(() => buildPayload(input), [input])

  const errorFor = useMemo(() => {
    const map = new Map<string, string>()
    for (const error of build.errors) map.set(error.field, error.message)
    return (field: string) => (touched[field] ? map.get(field) : undefined)
  }, [build.errors, touched])

  return { state, setType, set, touch, input, build, errorFor }
}
