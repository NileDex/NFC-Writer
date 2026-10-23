import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeFlashError, isPlaceholder } from './flash'
import type { FirmwareManifest, ManifestBuild } from './flash'

describe('describeFlashError', () => {
  it('explains a cancelled port picker', () => {
    const error = new Error('No port selected by the user')
    error.name = 'NotFoundError'
    const failure = describeFlashError(error)
    expect(failure.title).toMatch(/No serial port/)
    expect(failure.fixes.length).toBeGreaterThan(2)
    expect(failure.fixes.join(' ')).toMatch(/driver/i)
  })

  it('explains a boot-mode sync failure', () => {
    const failure = describeFlashError(new Error('Failed to connect to ESP32: No serial data received.'))
    expect(failure.title).toMatch(/sync/i)
    expect(failure.fixes.join(' ')).toMatch(/BOOT button/)
  })

  it('explains a port that is already open', () => {
    const error = new Error('Cannot open port')
    error.name = 'InvalidStateError'
    expect(describeFlashError(error).title).toMatch(/already open/)
  })

  it('explains a write failure', () => {
    const failure = describeFlashError(new Error('MD5 of flashed data does not match'))
    expect(failure.title).toMatch(/write failed/i)
  })

  it('falls back to the raw message', () => {
    const failure = describeFlashError(new Error('something unusual happened'))
    expect(failure.title).toContain('something unusual happened')
    expect(failure.fixes.length).toBeGreaterThan(0)
  })
})

describe('isPlaceholder', () => {
  const build: ManifestBuild = {
    id: 'x',
    name: 'X',
    chip: 'esp32',
    baud: 115200,
    parts: [{ path: 'a.bin', offset: '0x1000' }],
  }

  it('is true when the manifest or the build is marked placeholder', () => {
    expect(isPlaceholder({ placeholder: true, builds: [build] }, build)).toBe(true)
    expect(isPlaceholder({ placeholder: false, builds: [build] }, { ...build, placeholder: true })).toBe(
      true,
    )
    expect(isPlaceholder({ placeholder: false, builds: [build] }, build)).toBe(false)
  })
})

describe('public/firmware/manifest.json', () => {
  const manifestPath = resolve(process.cwd(), 'public/firmware/manifest.json')

  it('exists and parses', () => {
    expect(existsSync(manifestPath)).toBe(true)
  })

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FirmwareManifest

  it('declares at least one build with valid hex offsets', () => {
    expect(manifest.builds.length).toBeGreaterThan(0)
    for (const build of manifest.builds) {
      expect(build.id).toBeTruthy()
      expect(build.chip).toBe('esp32')
      expect(build.baud).toBeGreaterThan(0)
      for (const part of build.parts) {
        expect(part.offset).toMatch(/^0x[0-9a-fA-F]+$/)
        expect(part.path).toMatch(/\.bin$/)
      }
    }
  })

  it('ships a universal-writer build with the standard ESP32 layout', () => {
    const build = manifest.builds.find((b) => b.id === 'universal-writer')
    expect(build).toBeDefined()
    const offsets = build!.parts.map((part) => part.offset.toLowerCase())
    expect(offsets).toContain('0x1000') // 2nd-stage bootloader
    expect(offsets).toContain('0x8000') // partition table
    expect(offsets).toContain('0x10000') // application
  })

  it('marks placeholder binaries clearly (until real ones are dropped in)', () => {
    expect(manifest.placeholder).toBe(true)
    expect(manifest.note).toMatch(/placeholder/i)
  })

  it('every part file exists in public/firmware/', () => {
    for (const build of manifest.builds) {
      for (const part of build.parts) {
        const file = resolve(process.cwd(), 'public/firmware', part.path)
        expect(existsSync(file), `missing ${part.path}`).toBe(true)
      }
    }
  })
})
