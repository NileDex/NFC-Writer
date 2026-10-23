/**
 * Browser capability detection for Web Serial.
 * Web Serial only exists in Chromium desktop browsers, over a secure context.
 */

export interface SerialSupport {
  ok: boolean
  reason?: 'unsupported' | 'insecure'
  message: string
}

export function isSecureContextOk(): boolean {
  if (typeof window === 'undefined') return false
  if (window.isSecureContext) return true
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

export function hasWebSerial(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export function serialSupport(): SerialSupport {
  if (!hasWebSerial()) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'Web Serial is not available in this browser. Open this page in desktop Chrome or Edge (version 89 or newer) on Windows, macOS or Linux to connect a device.',
    }
  }
  if (!isSecureContextOk()) {
    return {
      ok: false,
      reason: 'insecure',
      message:
        'Browsers only allow serial access on secure pages. Open the site over https:// (or http://localhost during development).',
    }
  }
  return {
    ok: true,
    message: 'Web Serial is available - connect the ESP32 with a USB cable.',
  }
}

/** Short chip label for the status block. */
export function describePort(info: { usbVendorId?: number; usbProductId?: number } | undefined): string {
  if (!info || (info.usbVendorId === undefined && info.usbProductId === undefined)) {
    return 'Serial device'
  }
  const vendor = info.usbVendorId?.toString(16).toUpperCase().padStart(4, '0') ?? '----'
  const product = info.usbProductId?.toString(16).toUpperCase().padStart(4, '0') ?? '----'
  return `USB ${vendor}:${product}`
}
