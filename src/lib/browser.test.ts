import { describe, expect, it } from 'vitest'
import { serialSupport, hasWebSerial, isSecureContextOk, describePort } from './browser'

describe('serialSupport', () => {
  it('reports "unsupported" outside a Chromium browser', () => {
    const support = serialSupport()
    if (hasWebSerial()) {
      // Running inside a real Chromium - then it depends on the context only.
      expect(support.ok || support.reason === 'insecure').toBe(true)
    } else {
      expect(support.ok).toBe(false)
      expect(support.reason).toBe('unsupported')
      expect(support.message).toMatch(/Chrome or Edge/)
    }
  })

  it('has no Web Serial in the Node test environment', () => {
    expect(hasWebSerial()).toBe(false)
    expect(isSecureContextOk()).toBe(false) // no window in node
  })
})

describe('describePort', () => {
  it('falls back to a generic label', () => {
    expect(describePort(undefined)).toBe('Serial device')
    expect(describePort({})).toBe('Serial device')
  })

  it('formats USB ids as hex', () => {
    expect(describePort({ usbVendorId: 0x10c4, usbProductId: 0xea60 })).toBe('USB 10C4:EA60')
  })
})
