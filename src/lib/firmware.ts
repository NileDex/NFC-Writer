/**
 * Firmware generation for Method B ("generate custom firmware").
 * Templates are .ino.tpl files with {{PLACEHOLDER}} variables; all user
 * input is escaped through escapeCppString before it reaches the source.
 */

import readTemplate from '../templates/read-ndef.ino.tpl?raw'
import writeTemplate from '../templates/write-ndef.ino.tpl?raw'
import { NTAG213_USER_BYTES } from './ndef'
import { DEFAULT_BAUD } from './protocol'
import { buildPayload, type RecordInput } from './payload'
import {
  bytesToCppArray,
  escapeCppString,
  renderTemplate,
  sanitizeCommentText,
} from './template'

export interface GeneratedFirmware {
  filename: string
  code: string
  bytesUsed: number
  mode: 'write' | 'read'
}

export function generateWriteFirmware(input: RecordInput): GeneratedFirmware {
  const built = buildPayload(input)
  if (!built.ok || !built.message) {
    const first = built.errors[0]
    throw new Error(first ? `${first.field}: ${first.message}` : 'Invalid payload')
  }

  const title = sanitizeCommentText(`Write firmware - ${built.preview ?? ''}`)

  const code = renderTemplate(writeTemplate, {
    TITLE: title,
    PAYLOAD_TEXT_CPP: escapeCppString(built.preview ?? ''),
    NDEF_BYTES: bytesToCppArray(built.message),
    NDEF_LENGTH: String(built.message.length),
    BYTES_USED: String(built.bytesUsed),
    CAPACITY: String(NTAG213_USER_BYTES),
    BAUD: String(DEFAULT_BAUD),
  })

  return {
    filename: 'nfc_writer.ino',
    code,
    bytesUsed: built.bytesUsed ?? 0,
    mode: 'write',
  }
}

export function generateReadFirmware(): GeneratedFirmware {
  const code = renderTemplate(readTemplate, {
    TITLE: 'Read firmware - prints UID and NDEF content to the Serial Monitor',
    BAUD: String(DEFAULT_BAUD),
  })
  return { filename: 'nfc_reader.ino', code, bytesUsed: 0, mode: 'read' }
}
