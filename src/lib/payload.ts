/**
 * Record inputs: validation, normalization and payload building for the
 * Writer form. Everything the user types is validated and normalized here
 * before it reaches the NDEF encoder, the serial protocol or a C++ template.
 */

import {
  NTAG213_USER_BYTES,
  TNF,
  WSC_MIME,
  encodeNdefMessage,
  encodeTlv,
  tlvSize,
  textPayload,
  uriPayload,
  utf8,
  wifiPayload,
  wifiSecurityLabel,
  type WifiSecurity,
} from './ndef'

export type { WifiSecurity }
export type RecordType = 'url' | 'text' | 'wifi' | 'phone' | 'email'

export type RecordInput =
  | { type: 'url'; url: string }
  | { type: 'text'; text: string }
  | { type: 'wifi'; ssid: string; password: string; security: WifiSecurity }
  | { type: 'phone'; number: string }
  | { type: 'email'; email: string }

export interface FieldError {
  field: string
  message: string
}

export interface PayloadBuild {
  ok: boolean
  errors: FieldError[]
  /** NDEF message bytes (records only, no TLV). */
  message?: Uint8Array
  /** Message wrapped in the Type 2 TLV - what actually occupies user memory. */
  tlv?: Uint8Array
  bytesUsed?: number
  remaining?: number
  tooLarge?: boolean
  /** Human-readable description of what will be written to the tag. */
  preview?: string
  /** The normalized value (URL, tel:, etc.) - also what Method A sends. */
  normalizedValue?: string
}

/** A form state ready to write: the live input plus its encoded build. */
export interface RecordDraft {
  input: RecordInput
  build: PayloadBuild
}

export const RECORD_TYPES: ReadonlyArray<{
  id: RecordType
  label: string
  hint: string
}> = [
  { id: 'url', label: 'URL', hint: 'Opens a link when the tag is tapped' },
  { id: 'text', label: 'Plain text', hint: 'Any short text note' },
  { id: 'wifi', label: 'Wi-Fi', hint: 'Join a network by tapping (Android)' },
  { id: 'phone', label: 'Phone number', hint: 'Starts a call on tap' },
  { id: 'email', label: 'Email', hint: 'Opens a new email message' },
]

export function securityLabel(security: WifiSecurity): string {
  return wifiSecurityLabel(security)
}

/* ------------------------------------------------------------------ */
/* Normalization / validation                                          */
/* ------------------------------------------------------------------ */

export function normalizeUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Enter a URL' }
  if (/[\s<>"|\\^`]/.test(trimmed.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, ''))) {
    return { ok: false, error: 'URL cannot contain spaces or these characters: < > " | \\ ^ `' }
  }

  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
  const candidate = hasExplicitScheme ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { ok: false, error: 'That does not look like a valid URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// links are supported' }
  }
  if (!parsed.hostname) return { ok: false, error: 'URL is missing a domain name' }

  return { ok: true, url: candidate }
}

export function normalizePhone(raw: string): { ok: true; number: string } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Enter a phone number' }
  if (!/^[+\d][\d\s().-]*$/.test(trimmed)) {
    return { ok: false, error: 'Use digits, spaces and + ( ) - . only' }
  }
  const compact = trimmed.replace(/[\s().-]/g, '')
  if (!/^\+?\d{7,15}$/.test(compact)) {
    return { ok: false, error: 'Enter 7–15 digits, optionally starting with +' }
  }
  return { ok: true, number: compact }
}

export function normalizeEmail(raw: string): { ok: true; email: string } | { ok: false; error: string } {
  const email = raw.trim()
  if (!email) return { ok: false, error: 'Enter an email address' }
  if (email.length > 254) return { ok: false, error: 'Email address is too long' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'That does not look like a valid email address' }
  }
  if (email.split('@')[0].length > 64) {
    return { ok: false, error: 'The part before @ is too long' }
  }
  return { ok: true, email }
}

export function validateWifi(cred: {
  ssid: string
  password: string
  security: WifiSecurity
}): FieldError[] {
  const errors: FieldError[] = []
  const ssid = cred.ssid
  if (!ssid.trim()) {
    errors.push({ field: 'ssid', message: 'Enter the network name (SSID)' })
  } else if (utf8(ssid).length > 32) {
    errors.push({
      field: 'ssid',
      message: `SSID is ${utf8(ssid).length} bytes - the maximum is 32`,
    })
  } else if (/[\r\n]/.test(ssid)) {
    errors.push({ field: 'ssid', message: 'SSID cannot contain line breaks' })
  }

  const pass = cred.password
  if (cred.security === 'open') {
    // Open networks take no password; ignore whatever is in the field.
  } else if (cred.security === 'wep') {
    if (pass.length < 5 || pass.length > 13) {
      errors.push({ field: 'password', message: 'WEP keys are 5 or 13 characters long' })
    }
  } else {
    const isPskHex = pass.length === 64 && /^[0-9a-fA-F]+$/.test(pass)
    if (pass.length < 8 || (pass.length > 63 && !isPskHex)) {
      errors.push({
        field: 'password',
        message: 'WPA passwords are 8–63 characters (or a 64-digit hex key)',
      })
    }
  }
  return errors
}

/* ------------------------------------------------------------------ */
/* Building                                                            */
/* ------------------------------------------------------------------ */

function buildRecord(input: RecordInput): { record?: NdefRecord; errors: FieldError[]; value?: string; preview?: string } {
  switch (input.type) {
    case 'url': {
      const result = normalizeUrl(input.url)
      if (!result.ok) return { errors: [{ field: 'url', message: result.error }] }
      return {
        record: { tnf: TNF.WellKnown, type: 'U', payload: uriPayload(result.url) },
        errors: [],
        value: result.url,
        preview: result.url,
      }
    }
    case 'text': {
      if (!input.text.trim()) return { errors: [{ field: 'text', message: 'Enter some text' }] }
      return {
        record: { tnf: TNF.WellKnown, type: 'T', payload: textPayload(input.text) },
        errors: [],
        value: input.text,
        preview: input.text,
      }
    }
    case 'wifi': {
      const errors = validateWifi(input)
      if (errors.length > 0) return { errors }
      const security = input.security
      const password = security === 'open' ? '' : input.password
      return {
        record: {
          tnf: TNF.Mime,
          type: WSC_MIME,
          payload: wifiPayload({ ssid: input.ssid, password, security }),
        },
        errors: [],
        value: input.ssid,
        preview: `SSID "${input.ssid}" · ${securityLabel(security)} · password ${
          password ? `(${password.length} characters)` : '(none)'
        }`,
      }
    }
    case 'phone': {
      const result = normalizePhone(input.number)
      if (!result.ok) return { errors: [{ field: 'number', message: result.error }] }
      const tel = `tel:${result.number}`
      return {
        record: { tnf: TNF.WellKnown, type: 'U', payload: uriPayload(tel) },
        errors: [],
        value: tel,
        preview: tel,
      }
    }
    case 'email': {
      const result = normalizeEmail(input.email)
      if (!result.ok) return { errors: [{ field: 'email', message: result.error }] }
      const mailto = `mailto:${result.email}`
      return {
        record: { tnf: TNF.WellKnown, type: 'U', payload: uriPayload(mailto) },
        errors: [],
        value: mailto,
        preview: mailto,
      }
    }
  }
}

interface NdefRecord {
  tnf: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  type: string
  payload: Uint8Array
}

/**
 * Validate + encode a record input.
 * Reports field errors, the NDEF/TLV byte count against NTAG213 capacity
 * (144 bytes of user memory) and a human-readable preview.
 */
export function buildPayload(input: RecordInput): PayloadBuild {
  const built = buildRecord(input)
  if (!built.record || built.errors.length > 0) {
    return { ok: false, errors: built.errors }
  }

  const message = encodeNdefMessage([built.record])
  const tlv = encodeTlv(message)
  const bytesUsed = tlv.length
  const remaining = NTAG213_USER_BYTES - bytesUsed
  const tooLarge = bytesUsed > NTAG213_USER_BYTES

  const errors: FieldError[] = []
  if (tooLarge) {
    errors.push({
      field: 'payload',
      message: `This needs ${bytesUsed} bytes but an NTAG213 holds ${NTAG213_USER_BYTES} - shorten it by ${
        bytesUsed - NTAG213_USER_BYTES
      } bytes or use an NTAG215/216.`,
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    message,
    tlv,
    bytesUsed,
    remaining,
    tooLarge,
    preview: built.preview,
    normalizedValue: built.value,
  }
}

/** Approximate capacity check without building (used for hints). */
export function bytesRemainingFor(input: RecordInput): number | null {
  const built = buildPayload(input)
  return built.bytesUsed !== undefined ? built.remaining! : null
}

export { tlvSize }
