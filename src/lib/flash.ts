/**
 * Browser firmware flashing with esptool-js (Web Serial).
 *
 * Firmware images live in /public/firmware/ with offsets declared in
 * manifest.json. esptool-js is imported lazily so it never loads on pages
 * that do not flash.
 */

import type { SerialPortLike } from './serial'

export interface ManifestPart {
  path: string
  offset: string
}

export interface ManifestBuild {
  id: string
  name: string
  chip: string
  baud: number
  flashMode?: string
  flashFreq?: string
  flashSize?: string
  placeholder?: boolean
  parts: ManifestPart[]
}

export interface FirmwareManifest {
  placeholder: boolean
  builds: ManifestBuild[]
  note?: string
}

export interface FlashCallbacks {
  log: (text: string, kind?: 'info' | 'ok' | 'err') => void
  progress: (percent: number, label: string) => void
}

export const FIRMWARE_BASE = '/firmware/'

export async function loadFirmwareManifest(base: string = FIRMWARE_BASE): Promise<FirmwareManifest> {
  const response = await fetch(`${base}manifest.json`, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`Could not load ${base}manifest.json (HTTP ${response.status})`)
  }
  const data = (await response.json()) as Partial<FirmwareManifest>
  if (!Array.isArray(data.builds) || data.builds.length === 0) {
    throw new Error('Firmware manifest has no builds')
  }
  for (const build of data.builds) {
    if (!build.id || !Array.isArray(build.parts) || build.parts.length === 0) {
      throw new Error('Firmware manifest build is missing id or parts')
    }
    for (const part of build.parts) {
      if (!/^0x[0-9a-fA-F]+$/.test(part.offset)) {
        throw new Error(`Bad flash offset "${part.offset}" for ${part.path}`)
      }
    }
  }
  return {
    placeholder: data.placeholder ?? false,
    note: data.note,
    builds: data.builds,
  }
}

/** True when any build still ships placeholder binaries. */
export function isPlaceholder(manifest: FirmwareManifest, build: ManifestBuild): boolean {
  return manifest.placeholder || build.placeholder === true
}

export async function flashFirmware(
  port: SerialPortLike,
  build: ManifestBuild,
  callbacks: FlashCallbacks,
  base: string = FIRMWARE_BASE,
): Promise<string> {
  const { log, progress } = callbacks

  const files: Array<{ data: Uint8Array; address: number }> = []
  for (const part of build.parts) {
    log(`Fetching ${part.path} → ${part.offset}`, 'info')
    const response = await fetch(`${base}${part.path}`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Missing firmware file ${part.path} (HTTP ${response.status})`)
    }
    files.push({
      data: new Uint8Array(await response.arrayBuffer()),
      address: Number.parseInt(part.offset, 16),
    })
  }

  const { ESPLoader, Transport } = await import('esptool-js')

  const transport = new Transport(port as unknown as ConstructorParameters<typeof Transport>[0], true)
  const terminal = {
    clean: () => {},
    writeLine: (text: string) => log(text, 'info'),
    write: (text: string) => {
      const trimmed = text.replace(/\n$/, '')
      if (trimmed) log(trimmed, 'info')
    },
  }

  const loaderOptions = {
    transport,
    baudrate: build.baud,
    terminal,
    debugLogging: false,
  }
  const loader = new ESPLoader(loaderOptions as ConstructorParameters<typeof ESPLoader>[0])

  log('Syncing with the chip…', 'info')
  const chip = await loader.main()
  log(`Detected chip: ${chip}`, 'ok')

  progress(0, 'Erasing / preparing')
  const flashOptions = {
    fileArray: files,
    flashMode: build.flashMode ?? 'dio',
    flashFreq: build.flashFreq ?? '40m',
    flashSize: build.flashSize ?? '4MB',
    eraseAll: false,
    compress: true,
    reportProgress: (fileIndex: number, written: number, total: number) => {
      const withinFile = total > 0 ? written / total : 0
      const percent = ((fileIndex + withinFile) / files.length) * 100
      const part = build.parts[fileIndex]
      progress(
        Math.min(100, Math.round(percent)),
        part ? `Writing ${part.path}` : 'Writing image',
      )
    },
  }
  await loader.writeFlash(flashOptions as Parameters<typeof loader.writeFlash>[0])

  progress(100, 'Done')
  log('Flash complete - resetting the board…', 'ok')
  await loader.after('hard_reset')
  await transport.disconnect()
  return chip
}

export interface FlashFailure {
  title: string
  fixes: string[]
}

/** Map esptool/Web Serial errors to plain-language fixes. */
export function describeFlashError(error: unknown): FlashFailure {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  const all = `${name} ${message}`

  if (name === 'NotFoundError' || name === 'AbortError') {
    return {
      title: 'No serial port was selected',
      fixes: [
        'Pick your ESP32 board from the browser port list and press Connect again.',
        'No entry? Close the Arduino IDE Serial Monitor (or any terminal) - only one program can hold a port.',
        'Check the USB cable: cheap charge-only cables carry no data.',
        'Install the USB driver for your board (CP2102 or CH340) if the port never appears.',
      ],
    }
  }

  if (/already open|InvalidStateError/i.test(all)) {
    return {
      title: 'The serial port is already open',
      fixes: [
        'Another tab, window or program is using the port - close it and retry.',
        'Unplug the USB cable, wait two seconds, plug it back in, then reconnect.',
      ],
    }
  }

  if (/Failed to connect|Invalid head|timeout|No response|boot mode|Failed to get MAC|wrong boot mode/i.test(all)) {
    return {
      title: "Couldn't sync with the ESP32",
      fixes: [
        'Hold the BOOT button (GPIO0) while you press Connect, then release it once syncing starts.',
        'Use a data USB cable and a direct port (avoid unpowered hubs).',
        'Close the Arduino IDE Serial Monitor and any other serial terminal.',
        'Install/refresh the CP2102 or CH340 USB driver if no port shows up at all.',
        'Put the board in boot mode manually: hold BOOT, tap RST (or EN), then connect.',
      ],
    }
  }

  if (/write|erase|MD5|checksum|Failed to verify/i.test(all)) {
    return {
      title: 'The flash write failed',
      fixes: [
        'Move the board away from USB3 hubs or extension leads - signal noise breaks writes.',
        'Use a shorter, higher-quality USB cable and a port directly on the computer.',
        'Try again; if it fails repeatedly, lower the flashing speed or power the board separately.',
        'Make sure the firmware files are not placeholders (see README.md).',
      ],
    }
  }

  return {
    title: `Flashing failed: ${message}`,
    fixes: [
      'Unplug the board, close other serial tools, then plug it in again and retry.',
      'If the port never appears, install the CP2102/CH340 driver.',
      'Check the browser console for details (F12 → Console).',
    ],
  }
}
