import { describe, expect, it } from 'vitest'
import { tokenizeCpp, tokenizeJson } from './highlight'

function joined<T extends string>(tokens: Array<{ kind: T; text: string }>): string {
  return tokens.map((token) => token.text).join('')
}

describe('tokenizeCpp', () => {
  const source = [
    '#include <SPI.h>',
    '// a comment with "quotes" and /* fake */ markers',
    'const char *msg = "he said \\"hi\\"";',
    "char c = '\\n';",
    'uint8_t buf[4] = {0xE1, 0x10}; // trailing',
    'if (x == 1) { return 42; }',
    '',
  ].join('\n')

  it('round-trips the source without losing characters', () => {
    expect(joined(tokenizeCpp(source))).toBe(source)
  })

  it('classifies comments, strings, preprocessor and keywords', () => {
    const tokens = tokenizeCpp(source)
    const kinds = tokens.map((token) => `${token.kind}:${token.text}`)

    expect(kinds).toContain('preproc:#include <SPI.h>')
    expect(kinds.some((k) => k.startsWith('comment:// a comment with "quotes"'))).toBe(true)
    expect(kinds).toContain('string:"he said \\"hi\\""')
    expect(kinds).toContain("char:'\\n'")
    expect(kinds).toContain('number:0xE1')
    expect(kinds).toContain('keyword:if')
    expect(kinds).toContain('keyword:return')
    expect(kinds).toContain('number:42')
  })

  it('does not treat # inside a line as a preprocessor directive', () => {
    const tokens = tokenizeCpp('int a = b # c;\n#define X 1')
    expect(tokens.find((t) => t.kind === 'preproc')?.text).toBe('#define X 1')
  })

  it('handles an unterminated block comment', () => {
    const tokens = tokenizeCpp('/* never closed')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].kind).toBe('comment')
  })
})

describe('tokenizeJson', () => {
  const source = '{"ok": true, "uid": "04AB", "bytesUsed": 37, "error": null}'

  it('round-trips the source', () => {
    expect(joined(tokenizeJson(source))).toBe(source)
  })

  it('marks keys differently from string values', () => {
    const tokens = tokenizeJson(source)
    expect(tokens.find((t) => t.kind === 'key')?.text).toBe('"ok"')
    expect(tokens.some((t) => t.kind === 'key' && t.text === '"uid"')).toBe(true)
    expect(tokens.some((t) => t.kind === 'string' && t.text === '"04AB"')).toBe(true)
    expect(tokens.some((t) => t.kind === 'keyword' && t.text === 'true')).toBe(true)
    expect(tokens.some((t) => t.kind === 'keyword' && t.text === 'null')).toBe(true)
    expect(tokens.some((t) => t.kind === 'number' && t.text === '37')).toBe(true)
  })
})
