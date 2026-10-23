/**
 * Web Serial connection helper: request a port, read newline-delimited
 * lines, write commands. No dependencies on React.
 *
 * Web Serial exists only in Chromium desktop browsers over a secure context -
 * check serialSupport() first and show the friendly message.
 */

import { describePort } from './browser'
import { DEFAULT_BAUD } from './protocol'

export interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  getInfo?: () => { usbVendorId?: number; usbProductId?: number }
}

interface SerialLike {
  requestPort(options?: {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>
  }): Promise<SerialPortLike>
}

function getSerial(): SerialLike | undefined {
  return (navigator as unknown as { serial?: SerialLike }).serial
}

/**
 * Prompt for a port without opening it - esptool-js opens/closes the port
 * itself during flashing, so SerialConnection must not be used there.
 */
export async function requestSerialPort(): Promise<SerialPortLike> {
  const serial = getSerial()
  if (!serial) {
    throw new Error('Web Serial is not available in this browser')
  }
  return serial.requestPort()
}

export type LineHandler = (line: string) => void
export type CloseHandler = (reason: string) => void

export class SerialConnection {
  readonly portLabel: string
  onLine: LineHandler = () => {}
  onClose: CloseHandler = () => {}

  private port: SerialPortLike
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private decoder = new TextDecoder()
  private buffer = ''
  private closed = false

  private constructor(port: SerialPortLike) {
    this.port = port
    this.portLabel = describePort(port.getInfo?.())
  }

  /** Prompt for a port and open it. Rejects if the user cancels the picker. */
  static async request(baudRate: number = DEFAULT_BAUD): Promise<SerialConnection> {
    const serial = getSerial()
    if (!serial) {
      throw new Error('Web Serial is not available in this browser')
    }
    const port = await serial.requestPort()
    const connection = new SerialConnection(port)
    await connection.open(baudRate)
    return connection
  }

  private async open(baudRate: number): Promise<void> {
    await this.port.open({ baudRate })
    if (this.port.readable) {
      this.reader = this.port.readable.getReader()
      void this.readLoop()
    }
    if (this.port.writable) {
      this.writer = this.port.writable.getWriter()
    }
  }

  private async readLoop(): Promise<void> {
    const reader = this.reader
    if (!reader) return
    try {
      while (!this.closed) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) this.feed(value)
      }
      if (!this.closed) this.handleClosed('The device was disconnected')
    } catch (error) {
      if (!this.closed) {
        const reason = error instanceof Error ? error.message : 'Serial read error'
        this.handleClosed(reason)
      }
    }
  }

  private feed(bytes: Uint8Array): void {
    this.buffer += this.decoder.decode(bytes, { stream: true })
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      const line = this.buffer.slice(0, index).replace(/\r$/, '')
      this.buffer = this.buffer.slice(index + 1)
      if (line.length > 0) this.onLine(line)
      index = this.buffer.indexOf('\n')
    }
  }

  /** Send one command line (newline appended automatically). */
  async send(line: string): Promise<void> {
    if (this.closed || !this.writer) throw new Error('The serial port is not open')
    const payload = new TextEncoder().encode(line.endsWith('\n') ? line : `${line}\n`)
    await this.writer.write(payload)
  }

  get isOpen(): boolean {
    return !this.closed
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.releaseResources()
  }

  private handleClosed(reason: string): void {
    this.closed = true
    this.releaseResources()
    this.onClose(reason)
  }

  private releaseResources(): void {
    try {
      void this.reader?.cancel()
    } catch {
      /* ignore */
    }
    try {
      this.reader?.releaseLock()
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock()
    } catch {
      /* ignore */
    }
    try {
      void this.port.close()
    } catch {
      /* ignore */
    }
    this.reader = null
    this.writer = null
  }
}
