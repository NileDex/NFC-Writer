import { describe, expect, it } from 'vitest'
import {
  NTAG213_USER_BYTES,
  TNF,
  WSC_MIME,
  bytesToHex,
  decodeNdefMessage,
  decodeTlv,
  encodeNdefMessage,
  encodeTlv,
  hexToBytes,
  textPayload,
  tlvSize,
  uriPayload,
  utf8,
  wifiPayload,
} from './ndef'
import type { NdefRecordInput } from './ndef'

describe('uriPayload (RTD URI prefix compression)', () => {
  it('uses the https:// prefix code 0x04', () => {
    expect(bytesToHex(uriPayload('https://example.com'))).toBe('046578616D706C652E636F6D')
  })

  it('uses the http://www. prefix code 0x01', () => {
    expect(bytesToHex(uriPayload('http://www.example.com'))).toBe('016578616D706C652E636F6D')
  })

  it('prefers the longest matching prefix (https://www. over https://)', () => {
    expect(bytesToHex(uriPayload('https://www.example.com')).slice(0, 2)).toBe('03')
    expect(bytesToHex(uriPayload('https://example.com')).slice(0, 2)).toBe('04')
  })

  it('encodes tel: as prefix 0x05', () => {
    expect(bytesToHex(uriPayload('tel:+15551234567'))).toBe('052B3135353531323334353637')
  })

  it('encodes mailto: as prefix 0x06', () => {
    expect(bytesToHex(uriPayload('mailto:a@b.co'))).toBe('06' + bytesToHex(utf8('a@b.co')))
  })

  it('falls back to prefix 0x00 for unknown schemes', () => {
    expect(bytesToHex(uriPayload('example.com'))).toBe('00' + bytesToHex(utf8('example.com')))
  })

  it('keeps unicode paths as UTF-8', () => {
    expect(bytesToHex(uriPayload('https://münchen.de'))).toBe(
      '04' + bytesToHex(utf8('münchen.de')),
    )
  })
})

describe('textPayload', () => {
  it('sets the UTF-8 status byte with the language length', () => {
    expect(bytesToHex(textPayload('hi'))).toBe('82656E6869')
  })

  it('encodes non-ASCII text as UTF-8', () => {
    expect(bytesToHex(textPayload('日本語'))).toBe('82656E' + bytesToHex(utf8('日本語')))
  })

  it('honours a custom language code', () => {
    expect(bytesToHex(textPayload('bonjour', 'fr'))).toBe('826672' + bytesToHex(utf8('bonjour')))
  })
})

describe('encodeNdefMessage', () => {
  it('encodes a single short URI record byte-for-byte', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'U', payload: uriPayload('https://example.com') },
    ])
    // D1 = MB|ME|SR|TNF=well-known, typeLen 01, payloadLen 0C, type 'U'
    expect(bytesToHex(message)).toBe('D1010C55046578616D706C652E636F6D')
  })

  it('sets MB only on the first and ME only on the last record', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'T', payload: textPayload('A') },
      { tnf: TNF.WellKnown, type: 'T', payload: textPayload('B') },
    ])
    expect(message[0]).toBe(0x91) // MB=1 ME=0 SR=1 TNF=1
    const secondRecordOffset = 1 + 1 + 1 + 1 + 4 // header, typeLen, payLen, type, payload
    expect(message[secondRecordOffset]).toBe(0x51) // MB=0 ME=1 SR=1 TNF=1
  })

  it('drops SR for payloads over 255 bytes and uses a 32-bit length', () => {
    const bigText = 'x'.repeat(300)
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'T', payload: textPayload(bigText) },
    ])
    expect(message[0]).toBe(0xc1) // MB|ME|TNF=1, SR=0
    const payloadLength = (message[2] << 24) | (message[3] << 16) | (message[4] << 8) | message[5]
    expect(payloadLength).toBe(303) // status + "en" + 300 chars
    expect(payloadLength).toBeGreaterThan(255)
  })

  it('encodes a MIME record header for the Wi-Fi WSC type', () => {
    const message = encodeNdefMessage([
      {
        tnf: TNF.Mime,
        type: WSC_MIME,
        payload: wifiPayload({ ssid: 'HomeNet', password: 'hunter22', security: 'wpa' }),
      },
    ])
    expect(message[0]).toBe(0xd2) // MB|ME|SR|TNF=mime
    expect(message[1]).toBe(23) // length of application/vnd.wfa.wsc
    expect(bytesToHex(message.slice(3, 3 + 23))).toBe(bytesToHex(utf8(WSC_MIME)))
  })

  it('supports record IDs (IL flag)', () => {
    const message: NdefRecordInput[] = [
      {
        tnf: TNF.WellKnown,
        type: 'U',
        payload: uriPayload('https://a.co'),
        id: utf8('link'),
      },
    ]
    const bytes = encodeNdefMessage(message)
    expect(bytes[0] & 0x08).toBe(0x08) // IL set
    expect(bytes[0] & 0x10).toBe(0x10) // SR set
  })

  it('rejects empty messages and chunked records', () => {
    expect(() => encodeNdefMessage([])).toThrow(/at least one/)
    expect(() =>
      encodeNdefMessage([{ tnf: 6, type: 'U', payload: new Uint8Array([1]) }]),
    ).toThrow(/Chunked/)
  })
})

describe('Wi-Fi WSC payload', () => {
  const payload = wifiPayload({ ssid: 'HomeNet', password: 'hunter22', security: 'wpa' })

  it('starts with the Credential compound attribute (0x100E)', () => {
    expect(bytesToHex(payload.slice(0, 2))).toBe('100E')
  })

  it('contains SSID (0x1045) and Network Key (0x1027) attributes Android scans for', () => {
    const hex = bytesToHex(payload)
    expect(hex).toContain('1045')
    expect(hex).toContain('1027')
    expect(hex).toContain(bytesToHex(utf8('HomeNet')))
    expect(hex).toContain(bytesToHex(utf8('hunter22')))
  })

  it('uses mixed WPA/WPA2 auth 0x0022 and mixed TKIP/AES enc 0x000C', () => {
    const hex = bytesToHex(payload)
    expect(hex).toContain('100300020022')
    expect(hex).toContain('100F0002000C')
  })

  it('encodes open networks with auth 0x0001 / enc 0x0001 and an empty key', () => {
    const open = wifiPayload({ ssid: 'Guest', password: '', security: 'open' })
    const hex = bytesToHex(open)
    expect(hex).toContain('100300020001')
    expect(hex).toContain('100F00020001')
    expect(hex).toContain('10270000') // key with zero length
  })

  it('ends with the WFA vendor extension declaring WSC 2.0', () => {
    expect(bytesToHex(payload.slice(-10))).toBe('1049000600372A000120')
  })

  it('handles unicode SSIDs as UTF-8', () => {
    const w = wifiPayload({ ssid: 'カフェ', password: 'password1', security: 'wpa' })
    expect(bytesToHex(w)).toContain(bytesToHex(utf8('カフェ')))
  })
})

describe('Type 2 TLV', () => {
  it('wraps short messages as 0x03 | len | msg | 0xFE', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'U', payload: uriPayload('https://a.co') },
    ])
    const tlv = encodeTlv(message)
    expect(tlv[0]).toBe(0x03)
    expect(tlv[1]).toBe(message.length)
    expect(tlv[tlv.length - 1]).toBe(0xfe)
    expect(tlvSize(message.length)).toBe(message.length + 3)
    expect(tlv.length).toBe(message.length + 3)
  })

  it('uses the extended 0xFF length form above 254 bytes', () => {
    const big = new Uint8Array(300).fill(0xab)
    const tlv = encodeTlv(big)
    expect(tlv[0]).toBe(0x03)
    expect(tlv[1]).toBe(0xff)
    expect((tlv[2] << 8) | tlv[3]).toBe(300)
    expect(tlv.length).toBe(305)
    expect(tlvSize(300)).toBe(305)
  })

  it('round-trips through decodeTlv, including a leading null TLV', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'T', payload: textPayload('round trip') },
    ])
    expect(decodeTlv(encodeTlv(message))).toEqual(message)
    const withNull = new Uint8Array([0x00, ...encodeTlv(message)])
    expect(decodeTlv(withNull)).toEqual(message)
    expect(decodeTlv(encodeTlv(message).slice(0, 5))).toBeNull() // truncated
  })
})

describe('decodeNdefMessage', () => {
  it('round-trips a URI record', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'U', payload: uriPayload('https://example.com/x') },
    ])
    const [record] = decodeNdefMessage(message)
    expect(record.kind).toBe('uri')
    expect(record.uri).toBe('https://example.com/x')
    expect(record.tnfName).toBe('well-known')
  })

  it('round-trips a text record with language', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'T', payload: textPayload('hello world', 'de') },
    ])
    const [record] = decodeNdefMessage(message)
    expect(record.kind).toBe('text')
    expect(record.value).toBe('hello world')
    expect(record.lang).toBe('de')
  })

  it('round-trips a Wi-Fi record back to credentials', () => {
    const message = encodeNdefMessage([
      {
        tnf: TNF.Mime,
        type: WSC_MIME,
        payload: wifiPayload({ ssid: 'HomeNet', password: 'hunter22', security: 'wpa' }),
      },
    ])
    const [record] = decodeNdefMessage(message)
    expect(record.kind).toBe('wifi')
    expect(record.wifi).toMatchObject({
      ssid: 'HomeNet',
      password: 'hunter22',
      security: 'wpa',
    })
    expect(record.text).toContain('HomeNet')
  })

  it('round-trips multi-record messages', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'U', payload: uriPayload('https://a.co') },
      { tnf: TNF.WellKnown, type: 'T', payload: textPayload('second') },
    ])
    const records = decodeNdefMessage(message)
    expect(records).toHaveLength(2)
    expect(records[0].uri).toBe('https://a.co')
    expect(records[1].value).toBe('second')
  })

  it('throws on truncated input', () => {
    const message = encodeNdefMessage([
      { tnf: TNF.WellKnown, type: 'U', payload: uriPayload('https://example.com') },
    ])
    expect(() => decodeNdefMessage(message.slice(0, 6))).toThrow()
  })
})

describe('capacity constants', () => {
  it('NTAG213 user memory is 144 bytes', () => {
    expect(NTAG213_USER_BYTES).toBe(144)
  })

  it('hex helpers round-trip', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0xfe, 0xff])
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes)
    expect(bytesToHex(hexToBytes('de:ad:be:ef'))).toBe('DEADBEEF')
  })
})
