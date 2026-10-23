/**
 * Web NFC (Chrome on Android) write path for the phone writer device.
 * No browser NFC API is touched at module scope so this stays unit-testable.
 */

import { WSC_MIME, wifiPayload } from './ndef'
import { normalizeEmail, normalizePhone, normalizeUrl, validateWifi, type RecordInput } from './payload'

/** Plain form of an NDEF record init accepted by NDEFWriter.write(). */
export interface WebNfcRecordInit {
  recordType: 'url' | 'text' | 'mime'
  mediaType?: string
  data: string | Uint8Array
}

interface NdefWriterLike {
  write(message: unknown, options?: { signal?: AbortSignal }): Promise<void>
}

function readerConstructor(): (new () => NdefWriterLike) | undefined {
  return (globalThis as { NDEFReader?: new () => NdefWriterLike }).NDEFReader
}

/** True when this browser can write NFC tags from a page (secure context + NFC). */
export function webNfcSupported(): boolean {
  return readerConstructor() !== undefined
}

/**
 * Map a Writer-form record input to Web NFC record inits,
 * reusing the same normalization/validation as the serial path.
 */
export function webNfcRecords(
  input: RecordInput,
): { ok: true; records: WebNfcRecordInit[] } | { ok: false; message: string } {
  switch (input.type) {
    case 'url': {
      const result = normalizeUrl(input.url)
      if (!result.ok) return { ok: false, message: result.error }
      return { ok: true, records: [{ recordType: 'url', data: result.url }] }
    }
    case 'phone': {
      const result = normalizePhone(input.number)
      if (!result.ok) return { ok: false, message: result.error }
      return { ok: true, records: [{ recordType: 'url', data: `tel:${result.number}` }] }
    }
    case 'email': {
      const result = normalizeEmail(input.email)
      if (!result.ok) return { ok: false, message: result.error }
      return { ok: true, records: [{ recordType: 'url', data: `mailto:${result.email}` }] }
    }
    case 'text': {
      if (!input.text.trim()) return { ok: false, message: 'Enter some text' }
      return { ok: true, records: [{ recordType: 'text', data: input.text }] }
    }
    case 'wifi': {
      const errors = validateWifi(input)
      if (errors.length > 0) return { ok: false, message: errors[0].message }
      const password = input.security === 'open' ? '' : input.password
      return {
        ok: true,
        records: [
          {
            recordType: 'mime',
            mediaType: WSC_MIME,
            data: wifiPayload({ ssid: input.ssid, password, security: input.security }),
          },
        ],
      }
    }
  }
}

/**
 * Write records to the next tag held against the phone.
 * Resolves when the write lands; rejects with a DOM-style error.
 */
export async function writeWithWebNfc(records: WebNfcRecordInit[]): Promise<void> {
  const Ctor = readerConstructor()
  if (!Ctor) {
    const error = new Error('Web NFC is not available in this browser')
    error.name = 'NotSupportedError'
    throw error
  }
  const reader = new Ctor()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    await reader.write({ records }, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Turn a Web NFC rejection into a short, actionable message. */
export function describeNfcError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError') {
    return 'Timed out - keep the phone still against the tag until it writes.'
  }
  if (name === 'NotSupportedError') {
    return 'This browser can’t write NFC tags. Open the page in Chrome on an Android phone.'
  }
  if (name === 'SecurityError') {
    return 'NFC needs a secure context - serve the page over HTTPS or localhost.'
  }
  if (name === 'NotFoundError') {
    return 'No tag detected - hold the tag flat against the back of the phone.'
  }
  if (name === 'InvalidStateError' || name === 'NotReadableError' || name === 'QuitError') {
    return 'The write was interrupted - try again and hold the tag steady.'
  }
  return error instanceof Error && error.message ? error.message : 'The write failed - try again.'
}
