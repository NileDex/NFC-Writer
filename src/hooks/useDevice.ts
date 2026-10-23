import { useCallback, useEffect, useRef, useState } from 'react'
import { serialSupport, type SerialSupport } from '../lib/browser'
import {
  buildReadCommand,
  buildStatusCommand,
  buildWriteCommand,
  describeDeviceError,
  isFinalReply,
  parseDeviceLine,
  REPLY_TIMEOUT_MS,
  STATUS_TIMEOUT_MS,
  type DeviceReply,
} from '../lib/protocol'
import type { RecordInput } from '../lib/payload'
import { SerialConnection } from '../lib/serial'
import type { LogKind, LogLine } from '../components/LogPanel'

export interface DeviceInfo {
  fw?: string
  proto?: number
  baud?: number
}

export type WriteOutcome =
  | { ok: true; reply: Extract<DeviceReply, { ok: true }> }
  | { ok: false; message: string }

export type ReadOutcome =
  | { ok: true; reply: Extract<DeviceReply, { ok: true }> }
  | { ok: false; message: string }

export interface DeviceController {
  support: SerialSupport
  connection: SerialConnection | null
  connecting: boolean
  busy: boolean
  info: DeviceInfo | null
  log: LogLine[]
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  write: (input: RecordInput) => Promise<WriteOutcome>
  read: () => Promise<ReadOutcome>
  clearLog: () => void
}

interface Pending {
  resolve: (reply: DeviceReply) => void
  timer: number
}

/**
 * Serial device lifecycle: connect, send one command at a time, collect
 * newline-delimited replies, keep a scrolling log. One pending command at a
 * time - the UI disables buttons while `busy`.
 */
export function useDevice(): DeviceController {
  const support = useSerialSupport()
  const [connection, setConnection] = useState<SerialConnection | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<DeviceInfo | null>(null)
  const [log, setLog] = useState<LogLine[]>([])

  const connectionRef = useRef<SerialConnection | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const logIdRef = useRef(0)

  const appendLog = useCallback((text: string, kind: LogKind = 'info') => {
    logIdRef.current += 1
    const line: LogLine = { id: logIdRef.current, text, kind }
    setLog((prev) => [...prev.slice(-249), line])
  }, [])

  const settlePending = useCallback((reply: DeviceReply) => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    window.clearTimeout(pending.timer)
    pending.resolve(reply)
  }, [])

  const waitForReply = useCallback(
    (timeoutMs: number) =>
      new Promise<DeviceReply>((resolve) => {
        const timer = window.setTimeout(() => {
          pendingRef.current = null
          resolve({ ok: false, line: '', error: 'timeout' })
        }, timeoutMs)
        pendingRef.current = { resolve, timer }
      }),
    [],
  )

  const handleLine = useCallback(
    (raw: string) => {
      const reply = parseDeviceLine(raw)
      if (!isFinalReply(reply)) {
        appendLog(`← ${raw}`, 'dim')
        return
      }
      if (reply.ok) {
        appendLog(`← ${raw}`, 'ok')
      } else {
        appendLog(`← ${raw}`, 'err')
      }
      settlePending(reply)
    },
    [appendLog, settlePending],
  )

  const connect = useCallback(async () => {
    if (connectionRef.current || connecting) return
    setConnecting(true)
    try {
      const conn = await SerialConnection.request()
      conn.onLine = handleLine
      conn.onClose = (reason) => {
        appendLog(`Disconnected: ${reason}`, 'err')
        connectionRef.current = null
        setConnection(null)
        setInfo(null)
        settlePending({ ok: false, line: '', error: 'no_device', message: reason })
      }
      connectionRef.current = conn
      setConnection(conn)
      appendLog(`Connected to ${conn.portLabel}`, 'ok')

      // Handshake: ask for firmware/protocol info; tolerate old firmware.
      await conn.send(buildStatusCommand())
      const reply = await waitForReply(STATUS_TIMEOUT_MS)
      if (reply.ok) {
        const next: DeviceInfo = {}
        if (reply.fw !== undefined) next.fw = reply.fw
        if (reply.proto !== undefined) next.proto = reply.proto
        if (reply.baud !== undefined) next.baud = reply.baud
        setInfo(next)
        appendLog(
          `Device ready${reply.fw ? ` - fw ${reply.fw}` : ''}${
            reply.proto !== undefined ? `, protocol v${reply.proto}` : ''
          }`,
          'ok',
        )
      } else {
        appendLog('Device connected (no status reply - it may still be booting).', 'info')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/cancel|not selected|NotFoundError/i.test(message)) {
        appendLog(message, 'err')
      }
    } finally {
      setConnecting(false)
    }
  }, [appendLog, connecting, handleLine, settlePending, waitForReply])

  const disconnect = useCallback(async () => {
    const conn = connectionRef.current
    connectionRef.current = null
    setConnection(null)
    setInfo(null)
    settlePending({ ok: false, line: '', error: 'no_device' })
    if (conn) {
      await conn.close()
      appendLog('Disconnected.', 'dim')
    }
  }, [appendLog, settlePending])

  const runCommand = useCallback(
    async (line: string, timeoutMs: number): Promise<DeviceReply> => {
      const conn = connectionRef.current
      if (!conn || !conn.isOpen) return { ok: false, line, error: 'no_device' }
      await conn.send(line)
      return waitForReply(timeoutMs)
    },
    [waitForReply],
  )

  const write = useCallback(
    async (input: RecordInput): Promise<WriteOutcome> => {
      const command = buildWriteCommand(input)
      if (!command.ok) {
        return { ok: false, message: command.errors.map((e) => e.message).join(' ') }
      }
      setBusy(true)
      appendLog(`→ ${command.line}`, 'dim')
      try {
        const reply = await runCommand(command.line, REPLY_TIMEOUT_MS)
        if (reply.ok) return { ok: true, reply }
        return { ok: false, message: describeDeviceError(reply.error, reply.message) }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, message }
      } finally {
        setBusy(false)
      }
    },
    [appendLog, runCommand],
  )

  const read = useCallback(async (): Promise<ReadOutcome> => {
    const line = buildReadCommand()
    setBusy(true)
    appendLog(`→ ${line}`, 'dim')
    try {
      const reply = await runCommand(line, REPLY_TIMEOUT_MS)
      if (reply.ok) return { ok: true, reply }
      return { ok: false, message: describeDeviceError(reply.error, reply.message) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    } finally {
      setBusy(false)
    }
  }, [appendLog, runCommand])

  const clearLog = useCallback(() => setLog([]), [])

  useEffect(() => {
    return () => {
      const conn = connectionRef.current
      connectionRef.current = null
      if (conn) void conn.close()
    }
  }, [])

  return {
    support,
    connection,
    connecting,
    busy,
    info,
    log,
    connect,
    disconnect,
    write,
    read,
    clearLog,
  }
}

function useSerialSupport(): SerialSupport {
  // serialSupport reads navigator - compute once per mount.
  const [support] = useState(serialSupport)
  return support
}
