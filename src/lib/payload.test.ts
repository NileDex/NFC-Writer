import { describe, expect, it } from 'vitest'
import { NTAG213_USER_BYTES, decodeNdefMessage } from './ndef'
import {
  buildPayload,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
  validateWifi,
} from './payload'
import type { RecordInput } from './payload'

describe('normalizeUrl', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeUrl('example.com')).toEqual({ ok: true, url: 'https://example.com' })
    expect(normalizeUrl('  example.com/path  ')).toEqual({
      ok: true,
      url: 'https://example.com/path',
    })
  })

  it('keeps an explicit http/https scheme', () => {
    expect(normalizeUrl('HTTP://Example.com')).toEqual({ ok: true, url: 'HTTP://Example.com' })
    expect(normalizeUrl('https://example.com/a?b=1')).toEqual({
      ok: true,
      url: 'https://example.com/a?b=1',
    })
  })

  it('rejects unsupported schemes', () => {
    const result = normalizeUrl('ftp://example.com')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/http/)
  })

  it('rejects empty and malformed input', () => {
    expect(normalizeUrl('').ok).toBe(false)
    expect(normalizeUrl('https://').ok).toBe(false)
    expect(normalizeUrl('not a url').ok).toBe(false)
  })

  it('accepts internationalized domains', () => {
    expect(normalizeUrl('https://täst.de').ok).toBe(true)
  })
})

describe('normalizePhone', () => {
  it('strips formatting and keeps a leading +', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toEqual({ ok: true, number: '+15551234567' })
    expect(normalizePhone('020 123 4567')).toEqual({ ok: true, number: '0201234567' })
  })

  it('rejects letters and too-short numbers', () => {
    expect(normalizePhone('call me').ok).toBe(false)
    expect(normalizePhone('123').ok).toBe(false)
    expect(normalizePhone('').ok).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('accepts simple addresses', () => {
    expect(normalizeEmail(' user@example.co ')).toEqual({ ok: true, email: 'user@example.co' })
  })

  it('rejects malformed addresses', () => {
    expect(normalizeEmail('nope').ok).toBe(false)
    expect(normalizeEmail('a@b').ok).toBe(false)
    expect(normalizeEmail('a b@c.de').ok).toBe(false)
  })
})

describe('validateWifi', () => {
  it('requires a non-empty SSID', () => {
    const errors = validateWifi({ ssid: '  ', password: 'password1', security: 'wpa' })
    expect(errors.some((e) => e.field === 'ssid')).toBe(true)
  })

  it('caps the SSID at 32 UTF-8 bytes, not characters', () => {
    expect(validateWifi({ ssid: 'a'.repeat(32), password: 'password1', security: 'wpa' })).toEqual(
      [],
    )
    expect(
      validateWifi({ ssid: 'a'.repeat(33), password: 'password1', security: 'wpa' })[0].message,
    ).toMatch(/32/)
    // 11 × 3-byte characters = 33 bytes → over the limit even though it is 11 chars
    expect(validateWifi({ ssid: '日'.repeat(11), password: 'password1', security: 'wpa' })).toHaveLength(
      1,
    )
  })

  it('enforces WPA passphrase length (8–63 or 64-hex PSK)', () => {
    expect(validateWifi({ ssid: 'n', password: 'short', security: 'wpa' })).toHaveLength(1)
    expect(validateWifi({ ssid: 'n', password: '12345678', security: 'wpa' })).toEqual([])
    expect(validateWifi({ ssid: 'n', password: 'a'.repeat(63), security: 'wpa' })).toEqual([])
    expect(
      validateWifi({ ssid: 'n', password: 'A'.repeat(64), security: 'wpa' }),
    ).toEqual([])
    expect(
      validateWifi({ ssid: 'n', password: 'Z'.repeat(64), security: 'wpa' }),
    ).toHaveLength(1)
  })

  it('enforces WEP key length', () => {
    expect(validateWifi({ ssid: 'n', password: '12345', security: 'wep' })).toEqual([])
    expect(validateWifi({ ssid: 'n', password: '1234', security: 'wep' })).toHaveLength(1)
  })

  it('ignores the password for open networks', () => {
    expect(validateWifi({ ssid: 'guest', password: '', security: 'open' })).toEqual([])
  })
})

describe('buildPayload', () => {
  it('builds a URL payload and reports capacity', () => {
    const built = buildPayload({ type: 'url', url: 'example.com' })
    expect(built.ok).toBe(true)
    expect(built.normalizedValue).toBe('https://example.com')
    expect(built.preview).toBe('https://example.com')
    expect(built.bytesUsed!).toBeLessThan(NTAG213_USER_BYTES)
    expect(built.remaining).toBe(NTAG213_USER_BYTES - built.bytesUsed!)
    expect(built.message![0]).toBe(0xd1)
    const [record] = decodeNdefMessage(built.message!)
    expect(record.uri).toBe('https://example.com')
  })

  it('counts UTF-8 bytes, not characters', () => {
    const ascii = buildPayload({ type: 'text', text: 'x'.repeat(10) })
    const japanese = buildPayload({ type: 'text', text: 'あああああ' }) // 5 chars = 15 bytes
    expect(japanese.bytesUsed! - ascii.bytesUsed!).toBe(5)
  })

  it('computes known byte counts for a 100-char text note', () => {
    const built = buildPayload({ type: 'text', text: 'a'.repeat(100) })
    // payload = status(1) + "en"(2) + 100 = 103
    // record = header(3) + type(1) + 103 = 107; TLV adds 3 → 110
    expect(built.bytesUsed).toBe(110)
    expect(built.remaining).toBe(34)
    expect(built.ok).toBe(true)
  })

  it('fails with a clear message when the payload exceeds NTAG213 (144 bytes)', () => {
    const built = buildPayload({ type: 'text', text: 'a'.repeat(140) })
    expect(built.ok).toBe(false)
    expect(built.tooLarge).toBe(true)
    expect(built.errors[0].message).toContain('NTAG213')
    expect(built.errors[0].message).toContain(String(NTAG213_USER_BYTES))
    expect(built.errors[0].field).toBe('payload')
  })

  it('fails when max-size Wi-Fi credentials do not fit an NTAG213', () => {
    const built = buildPayload({
      type: 'wifi',
      ssid: 'a'.repeat(32),
      password: 'b'.repeat(63),
      security: 'wpa',
    })
    expect(built.ok).toBe(false)
    expect(built.tooLarge).toBe(true)
  })

  it('fits typical Wi-Fi credentials', () => {
    const built = buildPayload({
      type: 'wifi',
      ssid: 'HomeNet',
      password: 'hunter22',
      security: 'wpa',
    })
    expect(built.ok).toBe(true)
    expect(built.preview).toContain('HomeNet')
    expect(built.preview).toContain('WPA/WPA2')
    expect(built.bytesUsed!).toBeLessThanOrEqual(NTAG213_USER_BYTES)
    const [record] = decodeNdefMessage(built.message!)
    expect(record.wifi).toMatchObject({ ssid: 'HomeNet', security: 'wpa' })
  })

  it('encodes phone numbers as tel: URI records', () => {
    const built = buildPayload({ type: 'phone', number: '+1 (555) 123-4567' })
    expect(built.ok).toBe(true)
    expect(built.normalizedValue).toBe('tel:+15551234567')
    const [record] = decodeNdefMessage(built.message!)
    expect(record.uri).toBe('tel:+15551234567')
  })

  it('encodes email addresses as mailto: URI records', () => {
    const built = buildPayload({ type: 'email', email: 'someone@example.com' })
    expect(built.ok).toBe(true)
    expect(built.normalizedValue).toBe('mailto:someone@example.com')
    const [record] = decodeNdefMessage(built.message!)
    expect(record.uri).toBe('mailto:someone@example.com')
  })

  it('propagates field errors without producing a message', () => {
    const built = buildPayload({ type: 'url', url: '' })
    expect(built.ok).toBe(false)
    expect(built.message).toBeUndefined()
    expect(built.errors[0]).toEqual({ field: 'url', message: 'Enter a URL' })
  })

  it('returns TLV bytes that match bytesUsed', () => {
    const built = buildPayload({ type: 'text', text: 'note' })
    expect(built.tlv!.length).toBe(built.bytesUsed!)
    expect(built.tlv![0]).toBe(0x03)
    expect(built.tlv![built.tlv!.length - 1]).toBe(0xfe)
  })
})

describe('record inputs cover every form type', () => {
  it('builds all five types', () => {
    const inputs: RecordInput[] = [
      { type: 'url', url: 'example.com' },
      { type: 'text', text: 'note' },
      { type: 'wifi', ssid: 'n', password: '12345678', security: 'wpa' },
      { type: 'phone', number: '+15551234567' },
      { type: 'email', email: 'a@b.co' },
    ]
    for (const input of inputs) {
      const built = buildPayload(input)
      expect(built.ok, `${input.type} should build`).toBe(true)
      expect(built.bytesUsed).toBeGreaterThan(0)
    }
  })
})
