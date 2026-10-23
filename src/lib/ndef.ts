/**
 * NDEF encoding utilities.
 *
 * Pure functions, no DOM. Encodes NFC Forum NDEF messages (records + Type 2
 * TLV) exactly as they are stored on NTAG213/215/216 tags, and decodes them
 * back for the read UI. Heavily unit-tested - the firmware mirrors this logic.
 */

export type Tnf = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export const TNF = {
  Empty: 0,
  WellKnown: 1,
  Mime: 2,
  AbsoluteUri: 3,
  External: 4,
  Unknown: 5,
  Unchanged: 6,
  Reserved: 7,
} as const

export const TNF_NAMES: Record<number, string> = {
  0: 'empty',
  1: 'well-known',
  2: 'mime',
  3: 'absolute-uri',
  4: 'external',
  5: 'unknown',
  6: 'unchanged',
  7: 'reserved',
}

export interface NdefRecordInput {
  tnf: Tnf
  type: Uint8Array | string
  payload: Uint8Array
  id?: Uint8Array
}

/** NTAG213 user memory: pages 4–39 = 36 pages × 4 bytes. */
export const NTAG213_USER_BYTES = 144

/** MIME type of the Wi-Fi Simple Configuration record. */
export const WSC_MIME = 'application/vnd.wfa.wsc'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function utf8(text: string): Uint8Array {
  return encoder.encode(text)
}

export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes)
}

export function bytesToHex(bytes: Uint8Array, separator = ''): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(separator)
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[\s:]/g, '')
  if (clean.length % 2 !== 0) throw new Error('Hex string must have an even length')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) throw new Error(`Invalid hex at position ${i * 2}`)
    out[i] = byte
  }
  return out
}

/* ------------------------------------------------------------------ */
/* URI records (RTD URI prefix compression)                            */
/* ------------------------------------------------------------------ */

/** NFC Forum RTD URI identifier codes, longest prefix first. */
export const URI_PREFIXES: ReadonlyArray<readonly [code: number, prefix: string]> = [
  [0x01, 'http://www.'],
  [0x03, 'https://www.'],
  [0x07, 'ftp://anonymous:anonymous@'],
  [0x08, 'ftp://ftp.'],
  [0x02, 'http://'],
  [0x04, 'https://'],
  [0x05, 'tel:'],
  [0x06, 'mailto:'],
  [0x09, 'ftps://'],
  [0x0a, 'sftp://'],
  [0x0b, 'smb://'],
  [0x0c, 'nfs://'],
  [0x0d, 'ftp://'],
  [0x0e, 'dav://'],
  [0x0f, 'news:'],
  [0x10, 'telnet://'],
  [0x11, 'imap:'],
  [0x12, 'rtsp://'],
  [0x13, 'urn:'],
  [0x14, 'pop:'],
  [0x15, 'sip:'],
  [0x16, 'sips://'],
  [0x17, 'tftp:'],
  [0x18, 'btspp:'],
  [0x19, 'btl2cap:'],
  [0x1a, 'btgoep:'],
  [0x1b, 'tcpobex:'],
  [0x1c, 'irdaobex:'],
  [0x1d, 'file:'],
  [0x1e, 'urn:epc:id:'],
  [0x1f, 'urn:epc:tag:'],
  [0x20, 'urn:epc:pat:'],
  [0x21, 'urn:epc:raw:'],
  [0x22, 'urn:epc:'],
  [0x23, 'urn:nfc:'],
]

/** Build the payload of a Well-Known URI record: prefix byte + remainder. */
export function uriPayload(uri: string): Uint8Array {
  let code = 0x00
  let prefix = ''
  for (const [candidateCode, candidatePrefix] of URI_PREFIXES) {
    if (uri.startsWith(candidatePrefix)) {
      code = candidateCode
      prefix = candidatePrefix
      break
    }
  }
  const rest = utf8(uri.slice(prefix.length))
  const out = new Uint8Array(1 + rest.length)
  out[0] = code
  out.set(rest, 1)
  return out
}

/** Build the payload of a Well-Known Text record (UTF-8, IANA language tag). */
export function textPayload(text: string, lang = 'en'): Uint8Array {
  const langBytes = utf8(lang)
  if (langBytes.length > 63) throw new Error('Language code must be at most 63 bytes')
  const textBytes = utf8(text)
  const out = new Uint8Array(1 + langBytes.length + textBytes.length)
  out[0] = 0x80 | langBytes.length // bit 7 = UTF-8, bits 0–5 = language length
  out.set(langBytes, 1)
  out.set(textBytes, 1 + langBytes.length)
  return out
}

/* ------------------------------------------------------------------ */
/* Wi-Fi Simple Configuration record                                   */
/* ------------------------------------------------------------------ */

export type WifiSecurity = 'open' | 'wep' | 'wpa'

export interface WifiCredentials {
  ssid: string
  password: string
  security: WifiSecurity
}

const WSC_ATTR = {
  Credential: 0x100e,
  NetworkIndex: 0x1026,
  AuthType: 0x1003,
  EncryptionType: 0x100f,
  Ssid: 0x1045,
  NetworkKey: 0x1027,
  MacAddress: 0x1020,
  VendorExtension: 0x1049,
} as const

/** WSC Authentication Type values (Wi-Fi Simple Config spec). */
export const WSC_AUTH = {
  Open: 0x0001,
  WpaWpa2PersonalMixed: 0x0022,
} as const

/** WSC Encryption Type values. */
export const WSC_ENC = {
  None: 0x0001,
  Wep: 0x0002,
  TkipAesMixed: 0x000c,
} as const

function wscAttr(id: number, value: Uint8Array): number[] {
  return [
    (id >> 8) & 0xff,
    id & 0xff,
    (value.length >> 8) & 0xff,
    value.length & 0xff,
    ...value,
  ]
}

function wscAttrU16(id: number, value: number): number[] {
  return [(id >> 8) & 0xff, id & 0xff, 0x00, 0x02, (value >> 8) & 0xff, value & 0xff]
}

/**
 * Payload of a MIME record "application/vnd.wfa.wsc" - a WSC Configuration
 * Token: a Credential compound attribute (network index, SSID, auth, enc,
 * network key, broadcast MAC) plus a WFA vendor extension declaring WSC 2.0.
 *
 * Android scans this payload for attributes 0x1045 (SSID) and 0x1027 (key)
 * and offers to join the network.
 */
export function wifiPayload(cred: WifiCredentials): Uint8Array {
  const ssidBytes = utf8(cred.ssid)
  const keyBytes = utf8(cred.password)

  let auth: number
  let enc: number
  switch (cred.security) {
    case 'open':
      auth = WSC_AUTH.Open
      enc = WSC_ENC.None
      break
    case 'wep':
      auth = WSC_AUTH.Open
      enc = WSC_ENC.Wep
      break
    case 'wpa':
      // Mixed WPA/WPA2-Personal + mixed TKIP/AES - the spec's value for
      // networks that accept either. Android ignores these fields.
      auth = WSC_AUTH.WpaWpa2PersonalMixed
      enc = WSC_ENC.TkipAesMixed
      break
  }

  const credentialInner = new Uint8Array([
    ...wscAttr(WSC_ATTR.NetworkIndex, new Uint8Array([0x01])),
    ...wscAttr(WSC_ATTR.Ssid, ssidBytes),
    ...wscAttrU16(WSC_ATTR.AuthType, auth),
    ...wscAttrU16(WSC_ATTR.EncryptionType, enc),
    ...wscAttr(WSC_ATTR.NetworkKey, keyBytes),
    ...wscAttr(WSC_ATTR.MacAddress, new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff])),
  ])

  // WFA vendor extension: OUI 00:37:2A + Version2 sub-element 0x20 (WSC 2.0)
  const vendorExtension = new Uint8Array([0x00, 0x37, 0x2a, 0x00, 0x01, 0x20])

  return new Uint8Array([
    ...wscAttr(WSC_ATTR.Credential, credentialInner),
    ...wscAttr(WSC_ATTR.VendorExtension, vendorExtension),
  ])
}

/* ------------------------------------------------------------------ */
/* Message / record encoding                                           */
/* ------------------------------------------------------------------ */

/**
 * Encode a list of records into an NDEF message.
 * Uses short-record headers where possible; supports MB/ME/SR/IL flags.
 */
export function encodeNdefMessage(records: NdefRecordInput[]): Uint8Array {
  if (records.length === 0) throw new Error('An NDEF message needs at least one record')

  const chunks: Uint8Array[] = []
  let total = 0

  records.forEach((record, index) => {
    if (record.tnf === TNF.Unchanged) {
      throw new Error('Chunked NDEF records are not supported')
    }
    const typeBytes = typeof record.type === 'string' ? utf8(record.type) : record.type
    const payload = record.payload
    const id = record.id && record.id.length > 0 ? record.id : undefined

    if (record.tnf === TNF.Empty && (typeBytes.length > 0 || payload.length > 0)) {
      throw new Error('TNF_EMPTY records must have empty type and payload')
    }

    const sr = payload.length <= 0xff
    const il = id !== undefined
    // Header bits: MB=0x80 ME=0x40 CF=0x20 SR=0x10 IL=0x08 TNF=0x07
    const header =
      (record.tnf & 0x07) |
      (index === 0 ? 0x80 : 0) | // MB
      (index === records.length - 1 ? 0x40 : 0) | // ME
      (sr ? 0x10 : 0) | // SR
      (il ? 0x08 : 0) // IL

    const head: number[] = [header, typeBytes.length]
    if (sr) {
      head.push(payload.length)
    } else {
      head.push(
        (payload.length >>> 24) & 0xff,
        (payload.length >>> 16) & 0xff,
        (payload.length >>> 8) & 0xff,
        payload.length & 0xff,
      )
    }
    if (il) head.push(id!.length)

    const headBytes = new Uint8Array(head)
    const parts = [headBytes, typeBytes]
    if (id) parts.push(id)
    parts.push(payload)

    const recordBytes = concat(parts)
    chunks.push(recordBytes)
    total += recordBytes.length
  })

  return concat(chunks, total)
}

function concat(parts: Uint8Array[], knownTotal?: number): Uint8Array {
  const total = knownTotal ?? parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Type 2 Tag TLV                                                      */
/* ------------------------------------------------------------------ */

/** Bytes an NDEF message of `messageLength` occupies inside tag user memory. */
export function tlvSize(messageLength: number): number {
  if (messageLength < 0) throw new Error('Message length cannot be negative')
  return messageLength <= 254 ? messageLength + 3 : messageLength + 5
}

/**
 * Wrap an NDEF message in the Type 2 Tag TLV that lives in user memory:
 * 0x03 | length | message | 0xFE  (extended 0xFF form above 254 bytes).
 */
export function encodeTlv(message: Uint8Array): Uint8Array {
  const n = message.length
  if (n <= 254) {
    const out = new Uint8Array(n + 3)
    out[0] = 0x03
    out[1] = n
    out.set(message, 2)
    out[n + 2] = 0xfe
    return out
  }
  const out = new Uint8Array(n + 5)
  out[0] = 0x03
  out[1] = 0xff
  out[2] = (n >> 8) & 0xff
  out[3] = n & 0xff
  out.set(message, 4)
  out[n + 4] = 0xfe
  return out
}

/** Extract the NDEF message from a Type 2 TLV byte stream. */
export function decodeTlv(tlv: Uint8Array): Uint8Array | null {
  let pos = 0
  while (pos < tlv.length) {
    const tag = tlv[pos]
    if (tag === 0x00) {
      pos += 1 // null TLV
      continue
    }
    if (tag === 0xfe) return null // terminator
    if (pos + 1 >= tlv.length) return null
    let length = tlv[pos + 1]
    let headerSize = 2
    if (length === 0xff) {
      if (pos + 3 >= tlv.length) return null
      length = (tlv[pos + 2] << 8) | tlv[pos + 3]
      headerSize = 4
    }
    if (tag === 0x03) {
      const start = pos + headerSize
      if (start + length > tlv.length) return null
      return tlv.slice(start, start + length)
    }
    // Lock control / memory control TLVs: skip by declared length
    pos += headerSize + length
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Decoding (read UI + tests)                                          */
/* ------------------------------------------------------------------ */

export type DecodedKind = 'uri' | 'text' | 'wifi' | 'mime' | 'other' | 'empty'

export interface DecodedWifi {
  ssid: string
  password: string
  security: WifiSecurity | 'unknown'
  auth: number
  enc: number
}

export interface DecodedRecord {
  tnf: number
  tnfName: string
  type: string
  kind: DecodedKind
  /** Human-readable summary for lists/logs. */
  text: string
  uri?: string
  value?: string
  lang?: string
  wifi?: DecodedWifi
  payload: Uint8Array
}

function readU32(bytes: Uint8Array, pos: number): number {
  return (
    ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0
  )
}

/** Decode an NDEF message into records with human-readable summaries. */
export function decodeNdefMessage(message: Uint8Array): DecodedRecord[] {
  const records: DecodedRecord[] = []
  let pos = 0
  let first = true

  while (pos < message.length) {
    const header = message[pos++]
    const mb = (header >> 7) & 1
    const me = (header >> 6) & 1
    const cf = (header >> 5) & 1
    const sr = (header >> 4) & 1
    const il = (header >> 3) & 1
    const tnf = header & 0x07

    if (first && !mb) throw new Error('First NDEF record is missing the MB flag')
    first = false

    if (cf) throw new Error('Chunked NDEF records are not supported')
    if (tnf === TNF.Unchanged) throw new Error('Chunked NDEF records are not supported')
    if (pos >= message.length) throw new Error('Truncated NDEF record header')

    const typeLength = message[pos++]
    let payloadLength: number
    if (sr) {
      if (pos >= message.length) throw new Error('Truncated NDEF record payload length')
      payloadLength = message[pos++]
    } else {
      if (pos + 3 >= message.length) throw new Error('Truncated NDEF record payload length')
      payloadLength = readU32(message, pos)
      pos += 4
    }
    const idLength = il ? message[pos++] : 0

    if (pos + typeLength + idLength + payloadLength > message.length) {
      throw new Error('NDEF record extends past the end of the message')
    }

    const typeBytes = message.slice(pos, pos + typeLength)
    pos += typeLength
    pos += idLength
    const payload = message.slice(pos, pos + payloadLength)
    pos += payloadLength

    records.push(decodeRecord(tnf, typeBytes, payload))
    if (me) break
  }

  return records
}

function decodeRecord(tnf: number, typeBytes: Uint8Array, payload: Uint8Array): DecodedRecord {
  const type = isPrintableAscii(typeBytes) ? fromUtf8(typeBytes) : `0x${bytesToHex(typeBytes)}`
  const base = { tnf, tnfName: TNF_NAMES[tnf] ?? `tnf-${tnf}`, type, payload }

  if (tnf === TNF.Empty || (typeBytes.length === 0 && payload.length === 0)) {
    return { ...base, kind: 'empty', text: '(empty record)' }
  }

  if (tnf === TNF.WellKnown && type === 'U' && payload.length >= 1) {
    const code = payload[0]
    const prefix = URI_PREFIXES.find(([c]) => c === code)?.[1] ?? ''
    const uri = prefix + fromUtf8(payload.slice(1))
    return { ...base, kind: 'uri', uri, text: uri }
  }

  if (tnf === TNF.WellKnown && type === 'T' && payload.length >= 1) {
    const status = payload[0]
    const langLength = status & 0x3f
    const lang = fromUtf8(payload.slice(1, 1 + langLength))
    const value = fromUtf8(payload.slice(1 + langLength))
    return { ...base, kind: 'text', value, lang, text: value }
  }

  if (tnf === TNF.Mime && type === WSC_MIME) {
    const wifi = decodeWifiPayload(payload)
    if (wifi) {
      const label = wifiSecurityLabel(wifi.security)
      return {
        ...base,
        kind: 'wifi',
        wifi,
        text: `Wi-Fi: "${wifi.ssid}" (${label})`,
      }
    }
    return { ...base, kind: 'mime', text: `${type} (unrecognized layout)` }
  }

  if (tnf === TNF.Mime) {
    const preview = fromUtf8(payload.slice(0, 120))
    return { ...base, kind: 'mime', value: preview, text: `${type}: ${truncate(preview, 80)}` }
  }

  const previewHex = bytesToHex(payload.slice(0, 32))
  return { ...base, kind: 'other', text: `${type || 'untitled'} (${payload.length} bytes) ${previewHex}` }
}

function decodeWifiPayload(payload: Uint8Array): DecodedWifi | null {
  const attrs = walkWifiAttrs(payload, 1)
  const ssidAttr = attrs.find((a) => a.id === WSC_ATTR.Ssid)
  const keyAttr = attrs.find((a) => a.id === WSC_ATTR.NetworkKey)
  if (!ssidAttr) return null

  const authAttr = attrs.find((a) => a.id === WSC_ATTR.AuthType)
  const encAttr = attrs.find((a) => a.id === WSC_ATTR.EncryptionType)
  const auth = authAttr && authAttr.value.length === 2 ? readU16(authAttr.value) : 0
  const enc = encAttr && encAttr.value.length === 2 ? readU16(encAttr.value) : 0

  return {
    ssid: fromUtf8(ssidAttr.value),
    password: keyAttr ? fromUtf8(keyAttr.value) : '',
    security: securityFromWsc(auth, enc),
    auth,
    enc,
  }
}

function readU16(bytes: Uint8Array): number {
  return (bytes[0] << 8) | bytes[1]
}

interface WifiAttr {
  id: number
  value: Uint8Array
}

function walkWifiAttrs(bytes: Uint8Array, depth: number): WifiAttr[] {
  const attrs: WifiAttr[] = []
  let pos = 0
  while (pos + 4 <= bytes.length) {
    const id = (bytes[pos] << 8) | bytes[pos + 1]
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3]
    pos += 4
    if (pos + length > bytes.length) break
    const value = bytes.slice(pos, pos + length)
    pos += length
    if (id === WSC_ATTR.Credential && depth > 0) {
      attrs.push(...walkWifiAttrs(value, depth - 1))
    } else {
      attrs.push({ id, value })
    }
  }
  return attrs
}

function securityFromWsc(auth: number, enc: number): WifiSecurity | 'unknown' {
  if (enc === WSC_ENC.Wep) return 'wep'
  if (enc === WSC_ENC.None && auth === WSC_AUTH.Open) return 'open'
  if (
    auth === WSC_AUTH.WpaWpa2PersonalMixed ||
    auth === 0x0020 ||
    auth === 0x0002 ||
    auth === 0x0040
  ) {
    return 'wpa'
  }
  return 'unknown'
}

export function wifiSecurityLabel(security: WifiSecurity | 'unknown'): string {
  switch (security) {
    case 'open':
      return 'Open'
    case 'wep':
      return 'WEP'
    case 'wpa':
      return 'WPA/WPA2'
    default:
      return 'Unknown security'
  }
}

function isPrintableAscii(bytes: Uint8Array): boolean {
  return bytes.every((b) => b >= 0x20 && b <= 0x7e)
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
