/**
 * Tiny dependency-free syntax highlighters for the code panels.
 * They return token spans; React components map them to <span>s.
 */

export type CppTokenKind =
  | 'comment'
  | 'string'
  | 'char'
  | 'preproc'
  | 'keyword'
  | 'number'
  | 'plain'
  | 'punct'

export interface Token<T extends string = string> {
  kind: T
  text: string
}

const CPP_KEYWORDS = new Set([
  'alignas','alignof','and','asm','auto','bool','break','case','catch','char','class','const',
  'constexpr','const_cast','continue','default','delete','do','double','else','enum','explicit',
  'export','extern','false','float','for','friend','goto','if','inline','int','long','mutable',
  'namespace','new','noexcept','not','nullptr','operator','or','private','protected','public',
  'register','reinterpret_cast','return','short','signed','sizeof','static','static_assert',
  'static_cast','struct','switch','template','this','throw','true','try','typedef','typeid',
  'typename','union','unsigned','using','virtual','void','volatile','while','xor','uint8_t',
  'uint16_t','uint32_t','size_t','byte','String','F','NULL',
])

function isIdentStart(char: string): boolean {
  return /[A-Za-z_]/.test(char)
}

function isIdentPart(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char)
}

/** Tokenize C/C++-style source (used for generated .ino files). */
export function tokenizeCpp(source: string): Token<CppTokenKind>[] {
  const tokens: Token<CppTokenKind>[] = []
  let i = 0
  const push = (kind: CppTokenKind, text: string) => {
    if (text) tokens.push({ kind, text })
  }
  let lineStart = true

  while (i < source.length) {
    const char = source[i]
    const next = source[i + 1]

    // Line comment
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      push('comment', source.slice(i, stop))
      i = stop
      continue
    }

    // Block comment
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      push('comment', source.slice(i, stop))
      i = stop
      lineStart = false
      continue
    }

    // String literal
    if (char === '"') {
      let j = i + 1
      while (j < source.length) {
        if (source[j] === '\\') j += 2
        else if (source[j] === '"') {
          j += 1
          break
        } else j += 1
      }
      push('string', source.slice(i, j))
      i = j
      lineStart = false
      continue
    }

    // Character literal
    if (char === "'") {
      let j = i + 1
      while (j < source.length) {
        if (source[j] === '\\') j += 2
        else if (source[j] === "'") {
          j += 1
          break
        } else j += 1
      }
      push('char', source.slice(i, j))
      i = j
      lineStart = false
      continue
    }

    // Preprocessor line
    if (char === '#' && lineStart) {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      push('preproc', source.slice(i, stop))
      i = stop
      continue
    }

    // Number
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(next ?? ''))) {
      const match = source.slice(i).match(/^(?:0[xXbB][0-9a-fA-F]+|\d+\.?\d*(?:[eE][-+]?\d+)?)/)
      const text = match?.[0] ?? char
      push('number', text)
      i += text.length
      lineStart = false
      continue
    }

    // Identifier / keyword
    if (isIdentStart(char)) {
      let j = i + 1
      while (j < source.length && isIdentPart(source[j])) j += 1
      const text = source.slice(i, j)
      push(CPP_KEYWORDS.has(text) ? 'keyword' : 'plain', text)
      i = j
      lineStart = false
      continue
    }

    if (char === '\n') lineStart = true
    else if (!/\s/.test(char)) lineStart = false

    push(/\s/.test(char) ? 'plain' : 'punct', char)
    i += 1
  }

  return tokens
}

const JSON_KEYWORDS = new Set(['true', 'false', 'null'])

/** Tokenize JSON (used for protocol examples and device replies). */
export function tokenizeJson(source: string): Token<'string' | 'key' | 'number' | 'keyword' | 'punct' | 'plain'>[] {
  type JsonKind = 'string' | 'key' | 'number' | 'keyword' | 'punct' | 'plain'
  const tokens: Token<JsonKind>[] = []
  let i = 0
  const push = (kind: JsonKind, text: string) => {
    if (text) tokens.push({ kind, text })
  }

  while (i < source.length) {
    const char = source[i]

    if (char === '"') {
      let j = i + 1
      while (j < source.length) {
        if (source[j] === '\\') j += 2
        else if (source[j] === '"') {
          j += 1
          break
        } else j += 1
      }
      const text = source.slice(i, j)
      // A string followed by ':' (outside the string) is an object key
      let k = j
      while (k < source.length && /\s/.test(source[k])) k += 1
      push(source[k] === ':' ? 'key' : 'string', text)
      i = j
      continue
    }

    if (/[0-9-]/.test(char)) {
      const match = source.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/)
      const text = match?.[0] ?? char
      push('number', text)
      i += text.length
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      let j = i + 1
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j += 1
      const text = source.slice(i, j)
      push(JSON_KEYWORDS.has(text) ? 'keyword' : 'plain', text)
      i = j
      continue
    }

    push(/\s/.test(char) ? 'plain' : 'punct', char)
    i += 1
  }

  return tokens
}
