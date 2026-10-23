import { describe, expect, it } from 'vitest'
import { generateReadFirmware, generateWriteFirmware } from './firmware'
import { buildPayload } from './payload'

describe('generateWriteFirmware', () => {
  it('produces a complete .ino with no unresolved placeholders', () => {
    const { code, filename, bytesUsed, mode } = generateWriteFirmware({
      type: 'url',
      url: 'example.com',
    })
    expect(filename).toBe('nfc_writer.ino')
    expect(mode).toBe('write')
    expect(bytesUsed).toBeGreaterThan(0)
    expect(code).not.toMatch(/\{\{|\}\}/)
    expect(code).toContain('#include <MFRC522.h>')
    expect(code).toContain('#define RST_PIN 22')
    expect(code).toContain('#define SS_PIN 5')
    expect(code).toContain('SPI.begin(18, 19, 23, 5)')
    expect(code).toContain('BAUD 115200')
    expect(code).toContain('https://example.com')
  })

  it('bakes in the exact NDEF bytes the payload builder produced', () => {
    const input = { type: 'text', text: 'byte fidelity check' } as const
    const built = buildPayload(input)
    const { code } = generateWriteFirmware(input)

    const match = code.match(/static const uint8_t NDEF_MSG\[\] = \{([\s\S]*?)\};/)
    expect(match).not.toBeNull()
    const bytes = (match![1].match(/0x[0-9A-F]{2}/g) ?? []).map((hex) => Number.parseInt(hex, 16))
    expect(bytes).toEqual(Array.from(built.message!))
    expect(code).toContain(`static const uint16_t NDEF_LEN = ${built.message!.length};`)
  })

  it('escapes quotes, backslashes and unicode in the payload comment', () => {
    const text = 'He said "hi" \\ path 日本'
    const { code } = generateWriteFirmware({ type: 'text', text })
    // C++ string literal form of the payload - quotes/backslashes escaped,
    // UTF-8 bytes as 3-digit octal escapes.
    expect(code).toContain('He said \\"hi\\" \\\\ path')
    expect(code).toContain('\\346\\227\\245') // 日 = E6 97 A5 → 3-digit octal
    expect(code.includes('日')).toBe(false)
    // …and the comment-safe title uses the same text (comment, not a literal)
    expect(code).not.toMatch(/\{\{|\}\}/)
  })

  it('keeps braces that come from user input intact', () => {
    const { code } = generateWriteFirmware({ type: 'url', url: 'example.com/{{id}}' })
    expect(code).toContain('https://example.com/{{id}}')
    // …while still resolving every *template* placeholder.
    expect(code).not.toMatch(/\{\{(TITLE|BAUD|PAYLOAD_TEXT_CPP|NDEF_BYTES|NDEF_LENGTH|BYTES_USED|CAPACITY)\}\}/)
  })

  it('refuses to generate firmware for invalid or oversized payloads', () => {
    expect(() => generateWriteFirmware({ type: 'url', url: 'not a url' })).toThrow()
    expect(() => generateWriteFirmware({ type: 'text', text: 'a'.repeat(200) })).toThrow(
      /NTAG213/,
    )
  })

  it('includes the Wi-Fi NDEF bytes for Wi-Fi payloads', () => {
    const { code } = generateWriteFirmware({
      type: 'wifi',
      ssid: 'HomeNet',
      password: 'hunter22',
      security: 'wpa',
    })
    // The MIME type lives in the binary NDEF bytes, never as a literal string.
    expect(code).not.toContain('application/vnd.wfa.wsc')
    expect(code).toContain('SSID "HomeNet"')
    expect(code).not.toMatch(/\{\{|\}\}/)
  })
})

describe('generateReadFirmware', () => {
  it('produces a reader sketch that prints UID and NDEF', () => {
    const { code, filename, mode } = generateReadFirmware()
    expect(filename).toBe('nfc_reader.ino')
    expect(mode).toBe('read')
    expect(code).not.toMatch(/\{\{|\}\}/)
    expect(code).toContain('NFC Reader')
    expect(code).toContain('printNdef')
    expect(code).toContain('UID:')
    expect(code).toContain('BAUD 115200')
    expect(code).toContain('Never 5V')
  })
})
