import { describe, expect, it } from 'vitest'
import {
  TemplateError,
  bytesToCppArray,
  escapeCppString,
  renderTemplate,
  sanitizeCommentText,
} from './template'

/** Decode the *content* of a C++ string literal produced by escapeCppString. */
function decodeCppLiteral(literal: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < literal.length; i++) {
    const char = literal[i]
    if (char !== '\\') {
      const code = literal.charCodeAt(i)
      if (code > 0x7f) throw new Error(`unexpected raw non-ASCII char at ${i}`)
      bytes.push(code)
      continue
    }
    i++
    const next = literal[i]
    if (next === undefined) throw new Error('dangling backslash')
    switch (next) {
      case '\\':
        bytes.push(0x5c)
        break
      case '"':
        bytes.push(0x22)
        break
      case 'n':
        bytes.push(0x0a)
        break
      case 'r':
        bytes.push(0x0d)
        break
      case 't':
        bytes.push(0x09)
        break
      default: {
        if (next < '0' || next > '7') throw new Error(`unknown escape \\${next}`)
        let octal = next
        while (octal.length < 3 && /[0-7]/.test(literal[i + 1] ?? '')) {
          octal += literal[++i]
        }
        bytes.push(Number.parseInt(octal, 8))
      }
    }
  }
  return new Uint8Array(bytes)
}

function roundtrip(value: string): void {
  const escaped = escapeCppString(value)
  const decoded = decodeCppLiteral(escaped)
  expect(Array.from(decoded)).toEqual(Array.from(new TextEncoder().encode(value)))
}

describe('renderTemplate', () => {
  it('substitutes placeholders', () => {
    expect(renderTemplate('Hello {{name}}, x={{value}}', { name: 'World', value: '7' })).toBe(
      'Hello World, x=7',
    )
  })

  it('substitutes repeated placeholders', () => {
    expect(renderTemplate('{{a}}-{{a}}', { a: 'ok' })).toBe('ok-ok')
  })

  it('throws when a variable is missing', () => {
    expect(() => renderTemplate('{{present}} {{absent}}', { present: 'x' })).toThrow(TemplateError)
    expect(() => renderTemplate('{{absent}}', {})).toThrow(/Missing template variable "absent"/)
  })

  it('throws when a variable is unused (typo guard)', () => {
    expect(() => renderTemplate('{{present}}', { present: 'x', unused: 'y' })).toThrow(
      /Unused template variable\(s\): unused/,
    )
  })

  it('throws on malformed placeholders', () => {
    expect(() => renderTemplate('{{ bad name }}', {})).toThrow(/Malformed placeholder/)
    expect(() => renderTemplate('{{unclosed', {})).toThrow(/Malformed placeholder/)
    expect(() => renderTemplate('}}{{', {})).toThrow(/Malformed placeholder/)
  })

  it('lets substituted values contain braces of their own', () => {
    expect(renderTemplate('{{value}}', { value: 'path/{{id}}/end {{x' })).toBe(
      'path/{{id}}/end {{x',
    )
  })
})

describe('escapeCppString', () => {
  it('escapes double quotes', () => {
    expect(escapeCppString('say "hi"')).toBe('say \\"hi\\"')
  })

  it('escapes backslashes', () => {
    expect(escapeCppString('C:\\temp')).toBe('C:\\\\temp')
    expect(escapeCppString('a\\b')).toBe('a\\\\b')
  })

  it('escapes newlines, carriage returns and tabs', () => {
    expect(escapeCppString('line1\nline2')).toBe('line1\\nline2')
    expect(escapeCppString('a\r\nb')).toBe('a\\r\\nb')
    expect(escapeCppString('tab\there')).toBe('tab\\there')
  })

  it('uses 3-digit octal escapes for control characters', () => {
    expect(escapeCppString('\x00')).toBe('\\000')
    expect(escapeCppString('\x07')).toBe('\\007')
    expect(escapeCppString('\x1b')).toBe('\\033')
    expect(escapeCppString('\x7f')).toBe('\\177')
  })

  it('never emits a hex escape (which could swallow the next character)', () => {
    const escaped = escapeCppString('AÿB')
    expect(escaped).not.toMatch(/\\x/)
    // …and the octal escape is exactly 3 digits so it stops before the "B"
    expect(escaped.endsWith('B')).toBe(true)
    expect(escaped).toBe('A\\303\\277B')
  })

  it('encodes accented latin text as UTF-8 octal escapes', () => {
    expect(escapeCppString('é')).toBe('\\303\\251')
  })

  it('round-trips quotes, backslashes, unicode, emoji and control chars', () => {
    const samples = [
      'He said "hi" then left',
      'path\\to\\file "quoted"',
      'line1\nline2\ttabbed "mix"',
      'héllo wörld ünïcödé',
      '日本語のテキスト',
      'emoji 🌍🚀 and accents éàü',
      'bell\x07 and nul\x00 end',
      'back\\slash "quote" 🌍\nnew é',
      '',
      ' ',
    ]
    for (const sample of samples) roundtrip(sample)
  })

  it('keeps printable ASCII untouched', () => {
    const ascii = 'AZaz09 !#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
    expect(escapeCppString(ascii)).toBe(ascii.replace(/\\/g, '\\\\'))
  })
})

describe('sanitizeCommentText', () => {
  it('neutralizes comment terminators and newlines', () => {
    expect(sanitizeCommentText('evil */ code')).toBe('evil * / code')
    expect(sanitizeCommentText('line1\nline2')).toBe('line1 line2')
    expect(sanitizeCommentText('  spaced\n\nout  ')).toBe('spaced out')
  })
})

describe('bytesToCppArray', () => {
  it('formats a short list', () => {
    expect(bytesToCppArray(new Uint8Array([0x01, 0xab, 0xff]))).toBe('{ 0x01, 0xAB, 0xFF }')
  })

  it('wraps long lists over several lines', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7])
    expect(bytesToCppArray(bytes, 3)).toBe(
      '{\n  0x01, 0x02, 0x03,\n  0x04, 0x05, 0x06,\n  0x07\n}',
    )
  })

  it('handles empty input', () => {
    expect(bytesToCppArray(new Uint8Array(0))).toBe('{}')
  })

  it('always emits two hex digits', () => {
    expect(bytesToCppArray(new Uint8Array([0, 5, 15]))).toBe('{ 0x00, 0x05, 0x0F }')
  })
})
