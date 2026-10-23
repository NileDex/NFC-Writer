import { describe, expect, it } from 'vitest'
import {
  buildReadCommand,
  buildStatusCommand,
  buildWriteCommand,
  describeDeviceError,
  isFinalReply,
  parseDeviceLine,
  shortErrorLabel,
} from './protocol'

describe('command builders', () => {
  it('builds a URL write command exactly as documented', () => {
    const result = buildWriteCommand({ type: 'url', url: 'example.com' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.line).toBe('{"cmd":"write_ndef","type":"url","value":"https://example.com"}')
      expect(JSON.parse(result.line)).toEqual({
        cmd: 'write_ndef',
        type: 'url',
        value: 'https://example.com',
      })
    }
  })

  it('builds tel: and mailto: values', () => {
    const phone = buildWriteCommand({ type: 'phone', number: '+1 (555) 123-4567' })
    expect(phone.ok && JSON.parse(phone.line).value).toBe('tel:+15551234567')
    const email = buildWriteCommand({ type: 'email', email: 'a@b.co' })
    expect(email.ok && JSON.parse(email.line).value).toBe('mailto:a@b.co')
  })

  it('builds a flat Wi-Fi command with ssid/password/security', () => {
    const result = buildWriteCommand({
      type: 'wifi',
      ssid: 'My "Net"',
      password: 'p\\ass word',
      security: 'wpa',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const parsed = JSON.parse(result.line)
      expect(parsed).toEqual({
        cmd: 'write_ndef',
        type: 'wifi',
        ssid: 'My "Net"',
        password: 'p\\ass word',
        security: 'wpa',
      })
      // JSON round-trip must preserve quotes/backslashes exactly
      expect(parsed.ssid).toBe('My "Net"')
      expect(parsed.password).toBe('p\\ass word')
    }
  })

  it('sends an empty password for open networks', () => {
    const result = buildWriteCommand({ type: 'wifi', ssid: 'guest', password: 'ignored', security: 'open' })
    expect(result.ok && JSON.parse(result.line).password).toBe('')
  })

  it('rejects invalid or oversized payloads before they reach the device', () => {
    const invalid = buildWriteCommand({ type: 'url', url: '' })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.errors[0].field).toBe('url')

    const oversized = buildWriteCommand({ type: 'text', text: 'a'.repeat(200) })
    expect(oversized.ok).toBe(false)
    if (!oversized.ok) expect(oversized.errors[0].field).toBe('payload')
  })

  it('builds read and status commands', () => {
    expect(buildReadCommand()).toBe('{"cmd":"read"}')
    expect(buildStatusCommand()).toBe('{"cmd":"status"}')
  })
})

describe('parseDeviceLine', () => {
  it('parses a successful read reply', () => {
    const line = JSON.stringify({
      ok: true,
      uid: '04A1B2C3',
      tagType: 'NTAG213',
      capacity: 144,
      bytesUsed: 37,
      ndef: [{ tnf: 'well-known', type: 'U', uri: 'https://example.com' }],
    })
    const reply = parseDeviceLine(line)
    expect(reply.ok).toBe(true)
    if (reply.ok) {
      expect(reply.uid).toBe('04A1B2C3')
      expect(reply.tagType).toBe('NTAG213')
      expect(reply.bytesUsed).toBe(37)
      expect(reply.ndef?.[0].uri).toBe('https://example.com')
    }
  })

  it('parses a status reply', () => {
    const reply = parseDeviceLine('{"ok":true,"fw":"nfc-writer-universal","proto":1,"baud":115200}')
    expect(reply.ok).toBe(true)
    if (reply.ok) expect(reply.proto).toBe(1)
  })

  it('parses an error reply', () => {
    const reply = parseDeviceLine('{"ok":false,"error":"tag_not_found","message":"no tag in 15s"}')
    expect(reply.ok).toBe(false)
    if (!reply.ok) {
      expect(reply.error).toBe('tag_not_found')
      expect(reply.message).toBe('no tag in 15s')
    }
  })

  it('survives non-JSON garbage without throwing', () => {
    const reply = parseDeviceLine('ets Jun  8 2017 00:25:30')
    expect(reply.ok).toBe(false)
    if (!reply.ok) {
      expect(reply.error).toBe('bad_reply')
      expect(reply.message).toMatch(/not JSON/)
    }
  })

  it('flags replies that are objects without an ok field', () => {
    const reply = parseDeviceLine('{"event":"boot"}')
    expect(reply.ok).toBe(false)
    if (!reply.ok) expect(reply.error).toBe('bad_reply')
  })

  it('flags non-objects and empty lines', () => {
    expect(parseDeviceLine('[1,2,3]').ok).toBe(false)
    expect(parseDeviceLine('"just a string"').ok).toBe(false)
    expect(parseDeviceLine('   ').ok).toBe(false)
  })

  it('ignores junk lines when deciding whether a reply is final', () => {
    expect(isFinalReply(parseDeviceLine('boot noise'))).toBe(false)
    expect(isFinalReply(parseDeviceLine('{"ok":false,"error":"tag_locked"}'))).toBe(true)
    expect(isFinalReply(parseDeviceLine('{"ok":true}'))).toBe(true)
  })
})

describe('error copy', () => {
  it('returns actionable text for known codes', () => {
    expect(describeDeviceError('tag_not_found')).toMatch(/flat on the RC522/)
    expect(describeDeviceError('tag_locked')).toMatch(/locked/)
    expect(describeDeviceError('unsupported_tag')).toMatch(/NTAG213/)
    expect(describeDeviceError('payload_too_large')).toMatch(/NTAG215/)
  })

  it('falls back to the detail message, then to a generic one', () => {
    expect(describeDeviceError('weird_code', 'something odd')).toBe('something odd')
    expect(describeDeviceError('weird_code')).toBe(describeDeviceError('error'))
  })

  it('has short labels for status chips', () => {
    expect(shortErrorLabel('tag_not_found')).toBe('Tag not found')
    expect(shortErrorLabel('nope')).toBe('Error')
  })
})
