import { describe, expect, it } from 'vitest'
import { wifiPayload } from './ndef'
import { describeNfcError, webNfcRecords, webNfcSupported } from './webnfc'

describe('webNfcSupported', () => {
  it('is false in the test environment', () => {
    expect(webNfcSupported()).toBe(false)
  })
})

describe('webNfcRecords', () => {
  it('maps a URL to a url record', () => {
    expect(webNfcRecords({ type: 'url', url: 'https://example.com/menu' })).toEqual({
      ok: true,
      records: [{ recordType: 'url', data: 'https://example.com/menu' }],
    })
  })

  it('normalizes scheme-less URLs like the serial path', () => {
    expect(webNfcRecords({ type: 'url', url: 'example.com' })).toEqual({
      ok: true,
      records: [{ recordType: 'url', data: 'https://example.com' }],
    })
  })

  it('rejects invalid URLs', () => {
    const result = webNfcRecords({ type: 'url', url: 'not a url <x>' })
    expect(result.ok).toBe(false)
  })

  it('maps plain text to a text record', () => {
    expect(webNfcRecords({ type: 'text', text: 'hello world' })).toEqual({
      ok: true,
      records: [{ recordType: 'text', data: 'hello world' }],
    })
  })

  it('rejects empty text', () => {
    expect(webNfcRecords({ type: 'text', text: '   ' }).ok).toBe(false)
  })

  it('maps a phone number to a tel: url record', () => {
    expect(webNfcRecords({ type: 'phone', number: '+1 (555) 123-4567' })).toEqual({
      ok: true,
      records: [{ recordType: 'url', data: 'tel:+15551234567' }],
    })
  })

  it('maps an email to a mailto: url record', () => {
    expect(webNfcRecords({ type: 'email', email: 'hi@example.com' })).toEqual({
      ok: true,
      records: [{ recordType: 'url', data: 'mailto:hi@example.com' }],
    })
  })

  it('maps Wi-Fi credentials to a WSC mime record', () => {
    const result = webNfcRecords({
      type: 'wifi',
      ssid: 'home',
      password: 'secret123',
      security: 'wpa',
    })
    expect(result).toEqual({
      ok: true,
      records: [
        {
          recordType: 'mime',
          mediaType: 'application/vnd.wfa.wsc',
          data: wifiPayload({ ssid: 'home', password: 'secret123', security: 'wpa' }),
        },
      ],
    })
  })

  it('drops the password on open networks', () => {
    const result = webNfcRecords({
      type: 'wifi',
      ssid: 'guest',
      password: 'ignored',
      security: 'open',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.records[0].data).toEqual(
        wifiPayload({ ssid: 'guest', password: '', security: 'open' }),
      )
    }
  })

  it('rejects Wi-Fi without an SSID', () => {
    const result = webNfcRecords({ type: 'wifi', ssid: '', password: 'secret123', security: 'wpa' })
    expect(result.ok).toBe(false)
  })
})

describe('describeNfcError', () => {
  it('explains timeouts', () => {
    const error = new Error('aborted')
    error.name = 'AbortError'
    expect(describeNfcError(error)).toContain('Timed out')
  })

  it('explains missing Web NFC', () => {
    const error = new Error('nope')
    error.name = 'NotSupportedError'
    expect(describeNfcError(error)).toContain('Chrome on an Android phone')
  })

  it('explains missing tags', () => {
    const error = new Error('no tag')
    error.name = 'NotFoundError'
    expect(describeNfcError(error)).toContain('No tag detected')
  })

  it('falls back to the error message', () => {
    expect(describeNfcError(new Error('reader exploded'))).toBe('reader exploded')
  })

  it('handles non-error rejections', () => {
    expect(describeNfcError('weird')).toBe('The write failed - try again.')
  })
})
