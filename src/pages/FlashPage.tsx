import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { serialSupport } from '../lib/browser'
import {
  flashFirmware,
  isPlaceholder,
  loadFirmwareManifest,
  type FirmwareManifest,
  type ManifestBuild,
} from '../lib/flash'
import { requestSerialPort } from '../lib/serial'
import { Callout } from '../components/Callout'
import { LogPanel, type LogKind, type LogLine } from '../components/LogPanel'
import { Steps } from '../components/Steps'
import { ChipIcon, PlugIcon } from '../components/Icons'

export function FlashPage() {
  const support = serialSupport()
  const [manifest, setManifest] = useState<FirmwareManifest | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flashing, setFlashing] = useState(false)
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  const [error, setError] = useState<{ title: string; fixes: string[] } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const logIdRef = useRef(0)

  const appendLog = useCallback((text: string, kind: LogKind = 'info') => {
    logIdRef.current += 1
    const line: LogLine = { id: logIdRef.current, text, kind }
    setLog((prev) => [...prev.slice(-249), line])
  }, [])

  useEffect(() => {
    let cancelled = false
    loadFirmwareManifest()
      .then((loaded) => {
        if (cancelled) return
        setManifest(loaded)
        setSelectedId(loaded.builds[0]?.id ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setManifestError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = manifest?.builds.find((b) => b.id === selectedId) ?? null

  const onFlash = async () => {
    if (!selected) return
    setFlashing(true)
    setError(null)
    setDone(null)
    setProgress(null)
    setLog([])
    try {
      const port = await requestSerialPort()
      const chip = await flashFirmware(port, selected, {
        log: appendLog,
        progress: (percent, label) => setProgress({ percent, label }),
      })
      setDone(chip)
      setProgress(null)
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      const message = err instanceof Error ? err.message : String(err)
      if (name === 'NotFoundError' || name === 'AbortError') {
        appendLog('Port picker cancelled.', 'dim')
      } else {
        setError({
          title: message,
          fixes: [
            'Hold the BOOT button (GPIO0) while pressing Flash, then release it once syncing starts.',
            'Use a data USB cable and a direct port (avoid unpowered hubs).',
            'Close the Arduino IDE Serial Monitor and any other serial terminal.',
            'Install the CP2102 or CH340 USB driver if no port shows up at all.',
          ],
        })
        appendLog(message, 'err')
      }
    } finally {
      setFlashing(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Flash the firmware</h1>
        <p>One click over USB - no Arduino IDE needed.</p>
      </div>

      <div className="wizard">
        <Steps
          label="Flash progress"
          steps={[
            {
              label: 'Select build',
              state: selected ? 'done' : 'current',
            },
            {
              label: 'Flash firmware',
              state: done ? 'done' : selected ? 'current' : 'todo',
            },
            {
              label: 'Write tags',
              state: done ? 'current' : 'todo',
            },
          ]}
        />

        <div className="wizard__main">
        {!support.ok && <Callout kind="warn">{support.message}</Callout>}

        {manifestError && (
          <Callout kind="error">
            <strong>Could not load the firmware manifest.</strong> {manifestError}
          </Callout>
        )}

        {manifest && (
          <>
            {manifest.placeholder && (
              <Callout kind="warn">
                <strong>Placeholder firmware.</strong>{' '}
                {manifest.note ??
                  'The binaries referenced by this manifest are placeholders - build the firmware from source before flashing a real board.'}
              </Callout>
            )}

            <section className="panel">
              <div className="panel__head">
                <h3>Choose a build</h3>
                <span className="chip">{manifest.builds.length} available</span>
              </div>
              <div className="form-grid" role="radiogroup" aria-label="Firmware build">
                {manifest.builds.map((build) => (
                  <BuildOption
                    key={build.id}
                    build={build}
                    placeholder={isPlaceholder(manifest, build)}
                    selected={build.id === selectedId}
                    onSelect={() => setSelectedId(build.id)}
                  />
                ))}
              </div>
            </section>

            {selected && (
              <section className="panel">
                <div className="panel__head">
                  <h3>Flash</h3>
                  <span className="chip">
                    <ChipIcon size={12} />
                    {selected.chip} · {selected.baud} baud
                  </span>
                </div>

                <div className="btn-row" style={{ marginBottom: 'var(--space-4)' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void onFlash()}
                    disabled={flashing || !support.ok}
                  >
                    <PlugIcon />
                    {flashing ? 'Flashing…' : 'Flash over USB'}
                  </button>
                  {flashing && <span className="muted">Keep the board plugged in.</span>}
                </div>

                {progress && (
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="progress">
                      <div
                        className="progress__bar progress__bar--accent"
                        style={{ width: `${progress.percent}%` }}
                        role="progressbar"
                        aria-valuenow={progress.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                    <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
                      {progress.label} - {progress.percent}%
                    </p>
                  </div>
                )}

                <LogPanel lines={log} label="Flash log" />
              </section>
            )}

            {done && (
              <Callout kind="success">
                <strong>Flash complete.</strong> Chip: {done}. The board is resetting -
                unplug it, wire the RC522, then head to the{' '}
                <Link to="/write">Writer</Link>.
              </Callout>
            )}

            {error && (
              <Callout kind="error">
                <strong>{error.title}</strong>
                <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)' }}>
                  {error.fixes.map((fix) => (
                    <li key={fix} style={{ marginBottom: 'var(--space-1)' }}>
                      {fix}
                    </li>
                  ))}
                </ul>
              </Callout>
            )}
          </>
        )}
        </div>
      </div>
    </>
  )
}

function BuildOption({
  build,
  placeholder,
  selected,
  onSelect,
}: {
  build: ManifestBuild
  placeholder: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="panel panel--flat option-row"
      style={{
        boxShadow: selected ? '0 0 0 2px var(--color-primary)' : undefined,
      }}
    >
      <span className="option-row__tile">
        <ChipIcon size={15} />
      </span>
      <span className="option-row__body">
        <span className="option-row__title">
          <strong>{build.name}</strong>
          <span className="btn-row" style={{ gap: 'var(--space-2)' }}>
            {placeholder && <span className="chip chip--accent">placeholder</span>}
            <span className="chip chip--blue">{build.chip}</span>
          </span>
        </span>
        <span className="option-row__parts">
          {build.parts.map((part) => `${part.path} @ ${part.offset}`).join(' · ')}
        </span>
      </span>
    </button>
  )
}
