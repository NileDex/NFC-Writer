import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CodeBlock } from '../components/CodeBlock'
import { Callout } from '../components/Callout'
import { RecordForm } from '../components/RecordForm'
import { useRecordForm } from '../hooks/useRecordForm'
import { generateReadFirmware, generateWriteFirmware, type GeneratedFirmware } from '../lib/firmware'

type Mode = 'write' | 'read'

export function FirmwarePage() {
  const form = useRecordForm()
  const [mode, setMode] = useState<Mode>('write')

  const generated = useMemo<GeneratedFirmware | null>(() => {
    try {
      return mode === 'write' ? generateWriteFirmware(form.input) : generateReadFirmware()
    } catch {
      return null
    }
  }, [mode, form.input])

  const generationError = useMemo(() => {
    if (mode === 'read') return null
    try {
      generateWriteFirmware(form.input)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }, [mode, form.input])

  return (
    <>
      <div className="page-head">
        <h1>Generate firmware</h1>
        <p>
          A standalone sketch with the payload baked in - flash once, write tags with no
          computer attached.
        </p>
      </div>

      <div className="page-narrow" style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <section className="panel">
          <div className="panel__head">
            <h3>1 · Firmware mode</h3>
          </div>
          <div className="seg" role="group" aria-label="Firmware mode">
            <button
              type="button"
              aria-pressed={mode === 'write'}
              onClick={() => setMode('write')}
            >
              Write firmware
            </button>
            <button type="button" aria-pressed={mode === 'read'} onClick={() => setMode('read')}>
              Read firmware
            </button>
          </div>
          <p className="field__hint" style={{ marginTop: 'var(--space-3)' }}>
            {mode === 'write'
              ? 'Writes the record below to every tag presented to the antenna.'
              : 'Prints UID and NDEF contents to the Serial Monitor at 115200 baud.'}
          </p>
        </section>

        {mode === 'write' && (
          <section className="panel">
            <div className="panel__head">
              <h3>2 · Compose the record</h3>
              <span className="chip">{form.build.bytesUsed ?? 0} / 144 bytes</span>
            </div>
            <RecordForm form={form} />
          </section>
        )}

        {generationError &&
          form.build.errors.some((error) => form.errorFor(error.field)) && (
            <Callout kind="error">{generationError}</Callout>
          )}

        {generated && (
          <section className="panel">
            <div className="panel__head">
              <h3>{mode === 'write' ? '3 · Sketch' : '2 · Sketch'}</h3>
              <span className="chip chip--ok">
                {generated.bytesUsed > 0 ? `${generated.bytesUsed} payload bytes` : 'reader'}
              </span>
            </div>
            <CodeBlock
              code={generated.code}
              filename={generated.filename}
              downloadAs={generated.filename}
            />
          </section>
        )}

        <section className="panel">
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Flashing with the Arduino IDE</h3>
          <ol
            style={{
              margin: 0,
              paddingLeft: 'var(--space-5)',
              fontSize: 'var(--text-sm)',
              color: '#374151',
            }}
          >
            <li style={{ marginBottom: 'var(--space-2)' }}>
              Install the <strong>Arduino IDE</strong>, the{' '}
              <strong>ESP32 board package</strong>, and the <strong>MFRC522</strong>{' '}
              library (all via the built-in managers).
            </li>
            <li style={{ marginBottom: 'var(--space-2)' }}>
              Open the sketch, select <code>Tools → Board → ESP32 Dev Module</code> and
              the correct port.
            </li>
            <li>
              Press Upload. If it stalls, hold <strong>BOOT</strong> (GPIO0) while it
              starts, then release.
            </li>
          </ol>
          <p className="field__hint" style={{ marginTop: 'var(--space-4)' }}>
            Pin table on <Link to="/setup">Setup</Link> · prefer one-click USB? Use the{' '}
            <Link to="/flash">Flash page</Link>.
          </p>
        </section>
      </div>
    </>
  )
}
