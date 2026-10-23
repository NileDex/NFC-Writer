import { useState } from 'react'
import { useDevice } from '../hooks/useDevice'
import { Callout } from '../components/Callout'
import { DevicePanel } from '../components/DevicePanel'
import { Steps, type Step } from '../components/Steps'
import { TagIcon } from '../components/Icons'
import type { DeviceNdefRecord, DeviceReply } from '../lib/protocol'

type ReadResult = Extract<DeviceReply, { ok: true }> | null

export function ReadPage() {
  const device = useDevice()
  const [result, setResult] = useState<ReadResult>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  const connected = device.connection !== null
  const flags = [connected, result !== null]
  const current = flags.findIndex((flag) => !flag)
  const steps: Step[] = [
    { label: 'Connect device', state: flags[0] ? 'done' : current === 0 ? 'current' : 'todo' },
    { label: 'Read tag', state: flags[1] ? 'done' : current === 1 ? 'current' : 'todo' },
  ]

  const onRead = async () => {
    setError(null)
    setResult(null)
    const outcome = await device.read()
    if (outcome.ok) {
      setResult(outcome.reply)
    } else {
      setError(outcome.message)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Read a tag</h1>
        <p>Connect the ESP32, hold a Type 2 tag on the antenna, press Read.</p>
      </div>

      <div className="wizard">
        <Steps label="Read progress" steps={steps} />

        <div className="wizard__main">
          <DevicePanel
            device={device}
            actions={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void onRead()}
                disabled={!connected || device.busy}
              >
                <TagIcon />
                {device.busy ? 'Waiting for tag…' : 'Read tag'}
              </button>
            }
          />

          {error && <Callout kind="error">{error}</Callout>}

        {result && (
          <section className="panel">
            <div className="panel__head">
              <h3>Tag contents</h3>
              {result.tagType && <span className="chip chip--blue">{result.tagType}</span>}
            </div>

            <dl className="kv">
              <dt>UID</dt>
              <dd>{result.uid ?? '-'}</dd>
              {result.capacity !== undefined && (
                <>
                  <dt>Capacity</dt>
                  <dd>{result.capacity} bytes</dd>
                </>
              )}
              {result.bytesUsed !== undefined && (
                <>
                  <dt>Used</dt>
                  <dd>{result.bytesUsed} bytes</dd>
                </>
              )}
            </dl>

            <div className="section-gap">
              <p className="label-caps" style={{ marginBottom: 'var(--space-3)' }}>
                NDEF records ({result.ndef?.length ?? 0})
              </p>
              {result.ndef && result.ndef.length > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {result.ndef.map((record, index) => (
                    <NdefRecordCard key={index} record={record} />
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  No NDEF records found - the tag is blank or holds data this firmware
                  could not parse.
                </p>
              )}
            </div>

            {result.rawHex && (
              <div className="section-gap">
                <div className="btn-row" style={{ marginBottom: 'var(--space-3)' }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowRaw((v) => !v)}
                  >
                    {showRaw ? 'Hide raw bytes' : 'Show raw bytes'}
                  </button>
                </div>
                {showRaw && (
                  <p className="mono" style={{ wordBreak: 'break-all', fontSize: 'var(--text-xs)' }}>
                    {result.rawHex}
                  </p>
                )}
              </div>
            )}
          </section>
        )}
        </div>
      </div>
    </>
  )
}

function NdefRecordCard({ record }: { record: DeviceNdefRecord }) {
  const kind = record.wifi ? 'Wi-Fi' : record.uri ? 'URI' : record.text ? 'Text' : 'Other'
  const chipClass = record.wifi
    ? 'chip chip--accent'
    : record.uri
      ? 'chip chip--blue'
      : 'chip'

  return (
    <div className="panel panel--flat">
      <div className="panel__head" style={{ marginBottom: 'var(--space-2)' }}>
        <span className={chipClass}>{kind}</span>
        <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
          {record.tnf ? `${record.tnf} · ` : ''}
          {record.type ?? 'unknown'}
        </span>
      </div>

      {record.uri && (
        <p>
          <a href={record.uri} target="_blank" rel="noreferrer noreferrer">
            {record.uri}
          </a>
        </p>
      )}

      {record.text && !record.uri && <p>{record.text}</p>}

      {record.wifi && (
        <dl className="kv">
          <dt>SSID</dt>
          <dd>{record.wifi.ssid ?? '-'}</dd>
          <dt>Security</dt>
          <dd>{record.wifi.security ?? '-'}</dd>
          <dt>Password</dt>
          <dd>{record.wifi.password || '(open network)'}</dd>
        </dl>
      )}

      {!record.uri && !record.text && !record.wifi && record.raw && (
        <p className="mono muted" style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
          {record.raw}
        </p>
      )}

      {record.lang && (
        <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
          Language: {record.lang}
        </p>
      )}
    </div>
  )
}
