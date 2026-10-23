/**
 * Line-based JSON serial protocol shared by the browser and the universal
 * writer firmware. The wire format is documented in PROTOCOL.md.
 *
 * One command per line (LF-terminated), one JSON reply per line.
 */

import { buildPayload, type FieldError, type PayloadBuild, type RecordInput } from './payload'

export const PROTOCOL_VERSION = 1
export const DEFAULT_BAUD = 115200
/** Firmware waits up to 15 s for a tag; the client adds a safety margin. */
export const REPLY_TIMEOUT_MS = 20_000
/** How long we wait for the device to answer a status ping. */
export const STATUS_TIMEOUT_MS = 4_000

export interface DeviceNdefRecord {
  tnf?: string
  type?: string
  uri?: string
  text?: string
  lang?: string
  wifi?: { ssid?: string; security?: string; password?: string }
  raw?: string
}

export type DeviceReply =
  | {
      ok: true
      line: string
      uid?: string
      tagType?: string
      capacity?: number
      bytesUsed?: number
      ndef?: DeviceNdefRecord[]
      rawHex?: string
      fw?: string
      proto?: number
      baud?: number
      message?: string
    }
  | { ok: false; line: string; error: string; message?: string }

/* ------------------------------------------------------------------ */
/* Command builders                                                    */
/* ------------------------------------------------------------------ */

export type WriteCommandResult =
  | { ok: true; line: string; build: PayloadBuild }
  | { ok: false; errors: FieldError[] }

/**
 * Build a write_ndef command for Method A.
 * The payload is validated here (same rules as the preview) so an oversized
 * record never reaches the device; the ESP32 re-encodes the NDEF message.
 */
export function buildWriteCommand(input: RecordInput): WriteCommandResult {
  const build = buildPayload(input)
  if (!build.ok) return { ok: false, errors: build.errors }

  let command: Record<string, string>
  if (input.type === 'wifi') {
    command = {
      cmd: 'write_ndef',
      type: 'wifi',
      ssid: input.ssid,
      password: input.security === 'open' ? '' : input.password,
      security: input.security,
    }
  } else {
    command = {
      cmd: 'write_ndef',
      type: input.type,
      value: build.normalizedValue ?? '',
    }
  }
  return { ok: true, line: JSON.stringify(command), build }
}

export function buildReadCommand(): string {
  return JSON.stringify({ cmd: 'read' })
}

export function buildStatusCommand(): string {
  return JSON.stringify({ cmd: 'status' })
}

/* ------------------------------------------------------------------ */
/* Reply parsing                                                       */
/* ------------------------------------------------------------------ */

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Parse one line from the device. Never throws. */
export function parseDeviceLine(line: string): DeviceReply {
  const trimmed = line.trim()
  if (!trimmed) {
    return { ok: false, line, error: 'bad_reply', message: 'Empty line from device' }
  }

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    return {
      ok: false,
      line,
      error: 'bad_reply',
      message: 'Device sent a line that is not JSON',
    }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, line, error: 'bad_reply', message: 'Device reply is not a JSON object' }
  }

  const obj = data as Record<string, unknown>

  if (obj.ok === true) {
    const reply: Extract<DeviceReply, { ok: true }> = { ok: true, line: trimmed }
    const uid = asString(obj.uid)
    if (uid !== undefined) reply.uid = uid
    const tagType = asString(obj.tagType)
    if (tagType !== undefined) reply.tagType = tagType
    const capacity = asNumber(obj.capacity)
    if (capacity !== undefined) reply.capacity = capacity
    const bytesUsed = asNumber(obj.bytesUsed)
    if (bytesUsed !== undefined) reply.bytesUsed = bytesUsed
    const fw = asString(obj.fw)
    if (fw !== undefined) reply.fw = fw
    const proto = asNumber(obj.proto)
    if (proto !== undefined) reply.proto = proto
    const baud = asNumber(obj.baud)
    if (baud !== undefined) reply.baud = baud
    const message = asString(obj.message)
    if (message !== undefined) reply.message = message
    const rawHex = asString(obj.rawHex)
    if (rawHex !== undefined) reply.rawHex = rawHex
    if (Array.isArray(obj.ndef)) {
      reply.ndef = obj.ndef.filter(
        (entry): entry is DeviceNdefRecord =>
          typeof entry === 'object' && entry !== null && !Array.isArray(entry),
      ) as DeviceNdefRecord[]
    }
    return reply
  }

  if (obj.ok === false) {
    return {
      ok: false,
      line: trimmed,
      error: asString(obj.error) ?? 'error',
      message: asString(obj.message),
    }
  }

  return { ok: false, line: trimmed, error: 'bad_reply', message: 'Reply is missing an "ok" field' }
}

/** True when a parsed reply should settle a pending command. */
export function isFinalReply(reply: DeviceReply): boolean {
  return reply.ok || reply.error !== 'bad_reply'
}

/* ------------------------------------------------------------------ */
/* Error copy (plain language, shown next to the status block)         */
/* ------------------------------------------------------------------ */

const ERROR_MESSAGES: Record<string, string> = {
  tag_not_found:
    'No tag was detected. Lay the tag flat on the RC522 antenna - usually 0–5 mm above it - and hold it still.',
  tag_locked:
    'The tag refused the write. It looks locked or password-protected (common on purchased programming-locked tags).',
  unsupported_tag:
    'That tag type can not be written through the RC522. Use NTAG213/215/216 or MIFARE Ultralight-style Type 2 tags (ISO14443-A at 13.56 MHz).',
  payload_too_large:
    'The payload does not fit on this tag. Shorten the content, or use a bigger tag such as an NTAG215 or NTAG216.',
  write_failed:
    'The tag was found but writing failed. Move the tag slightly, keep it still, and try again - if it keeps failing the tag may be read-only or damaged.',
  read_failed: 'The tag was found but its contents could not be read. Try again with the tag held still.',
  bad_request: 'The firmware did not understand that command. Reflash the universal writer.',
  bad_reply: 'The device answered with something this page could not parse. Reflash the universal writer.',
  timeout: 'The device stopped responding. Check the cable, close other serial tools, then reconnect.',
  no_device: 'No serial device is connected.',
  error: 'The device reported an error.',
}

export function describeDeviceError(code: string, detail?: string): string {
  const known = ERROR_MESSAGES[code]
  if (known) return known
  return detail || ERROR_MESSAGES.error
}

export function shortErrorLabel(code: string): string {
  const labels: Record<string, string> = {
    tag_not_found: 'Tag not found',
    tag_locked: 'Tag locked',
    unsupported_tag: 'Unsupported tag',
    payload_too_large: 'Too large for tag',
    write_failed: 'Write failed',
    read_failed: 'Read failed',
    bad_request: 'Bad request',
    bad_reply: 'Bad reply',
    timeout: 'Timeout',
    no_device: 'No device',
    error: 'Error',
  }
  return labels[code] ?? 'Error'
}
