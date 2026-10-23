/**
 * Template rendering + C++ string escaping for firmware generation.
 *
 * Templates live in src/templates/*.ino.tpl with {{PLACEHOLDER}} variables.
 * All user input must go through escapeCppString (or one of the builders
 * below) before it lands in generated C++.
 */

import { utf8 } from './ndef'

export class TemplateError extends Error {
  override name = 'TemplateError'
}

const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_]+)\}\}/g
const SUSPECT_RE = /\{\{[^{}]*\}\}|\{\{|\}\}/g

/**
 * Substitute {{NAME}} placeholders. Strict: throws when a placeholder has no
 * variable, a variable is unused (typo guard) or a malformed {{...}} sits in
 * the template source. User-substituted values may themselves contain braces.
 */
export function renderTemplate(source: string, vars: Record<string, string>): string {
  const seen = new Set<string>()

  // Validate the *source* first so payload values with {{ }} survive.
  for (const match of source.matchAll(SUSPECT_RE)) {
    const text = match[0]
    const name = text.startsWith('{{') && text.endsWith('}}') ? match[0].slice(2, -2) : ''
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      throw new TemplateError(`Malformed placeholder near "${text}"`)
    }
    if (!Object.prototype.hasOwnProperty.call(vars, name)) {
      throw new TemplateError(`Missing template variable "${name}"`)
    }
    seen.add(name)
  }

  const rendered = source.replace(PLACEHOLDER_RE, (_match, name: string) => vars[name])

  const unused = Object.keys(vars).filter((key) => !seen.has(key))
  if (unused.length > 0) {
    throw new TemplateError(`Unused template variable(s): ${unused.join(', ')}`)
  }

  return rendered
}

/**
 * Escape a string so it can be embedded verbatim in a C++ string literal.
 *
 * Works on UTF-8 bytes: printable ASCII stays as-is, quotes/backslashes are
 * escaped, and anything else becomes a 3-digit octal escape. Octal (unlike
 * hex) is capped at 3 digits, so an escape can never swallow the next
 * character. The result decodes back to exactly the original bytes.
 */
export function escapeCppString(value: string): string {
  let out = ''
  for (const byte of utf8(value)) {
    switch (byte) {
      case 0x5c:
        out += '\\\\'
        break
      case 0x22:
        out += '\\"'
        break
      case 0x0a:
        out += '\\n'
        break
      case 0x0d:
        out += '\\r'
        break
      case 0x09:
        out += '\\t'
        break
      default:
        if (byte >= 0x20 && byte <= 0x7e) {
          out += String.fromCharCode(byte)
        } else {
          out += `\\${byte.toString(8).padStart(3, '0')}`
        }
    }
  }
  return out
}

/**
 * Make a value safe to place inside a /* … *\/ comment.
 * Printable ASCII stays as-is; anything else becomes a 3-digit octal escape
 * so generated sketches remain pure ASCII (some toolchains mangle UTF-8
 * source) and a payload byte can never close the comment.
 */
export function sanitizeCommentText(value: string): string {
  const normalized = value.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ').trim()
  let out = ''
  for (const byte of utf8(normalized)) {
    if (byte >= 0x20 && byte <= 0x7e) {
      out += String.fromCharCode(byte)
    } else {
      out += `\\${byte.toString(8).padStart(3, '0')}`
    }
  }
  return out
}

/** Render bytes as a C/C++ initializer list, wrapped for readability. */
export function bytesToCppArray(bytes: Uint8Array, perLine = 12): string {
  if (bytes.length === 0) return '{}'
  const items: string[] = Array.from(
    bytes,
    (b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`,
  )
  const lines: string[] = []
  for (let i = 0; i < items.length; i += perLine) {
    lines.push(items.slice(i, i + perLine).join(', '))
  }
  if (lines.length === 1) return `{ ${lines[0]} }`
  return `{\n  ${lines.join(',\n  ')}\n}`
}
