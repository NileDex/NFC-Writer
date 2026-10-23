import { useState } from 'react'
import type { RecordDraft } from '../lib/payload'
import { describeNfcError, webNfcSupported, webNfcRecords, writeWithWebNfc } from '../lib/webnfc'
import { Callout } from './Callout'
import { NfcIcon } from './Icons'

interface PhonePanelProps {
  /** Present on the Writer page - omitted on Read (phone reads aren't wired up yet). */
  record?: RecordDraft
  /** Called after every write attempt so the page's progress steps can follow. */
  onOutcome?: (ok: boolean) => void
}

type Outcome = { ok: true; message: string } | { ok: false; message: string }

/** Write flow for the Android / iOS phone device - Web NFC with a clear fallback. */
export function PhonePanel({ record, onOutcome }: PhonePanelProps) {
  const supported = webNfcSupported()
  const [writing, setWriting] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  if (!record) {
    return (
      <Callout kind="info">
        Reading tags with a phone isn’t wired up yet - switch to{' '}
        <strong>Microcontroller</strong> to read over serial.
      </Callout>
    )
  }

  if (!supported) {
    return (
      <Callout kind="info">
        <strong>Web NFC isn’t available in this browser.</strong> To write with a phone, open
        this page in Chrome on an Android phone (over HTTPS). iOS Safari can’t write NFC tags
        from a web page - use an app like NFC Tools there.
      </Callout>
    )
  }

  const { input, build } = record

  const onWrite = async () => {
    const records = webNfcRecords(input)
    if (!records.ok) {
      const failure = { ok: false as const, message: records.message }
      setOutcome(failure)
      onOutcome?.(false)
      return
    }
    setWriting(true)
    setOutcome(null)
    try {
      await writeWithWebNfc(records.records)
      setOutcome({ ok: true, message: 'Tag written - move the phone away from the tag.' })
      onOutcome?.(true)
    } catch (error) {
      setOutcome({ ok: false, message: describeNfcError(error) })
      onOutcome?.(false)
    } finally {
      setWriting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onWrite()}
          disabled={!build.ok || writing}
        >
          <NfcIcon />
          {writing ? 'Hold the tag to the phone…' : 'Write with this phone'}
        </button>
      </div>

      {!build.ok && !writing && (
        <p className="field__hint">Fill in the form above to enable writing.</p>
      )}

      {writing && (
        <p className="field__hint">
          Keep the phone still - the write completes when the tag is detected.
        </p>
      )}

      {outcome && (
        <Callout kind={outcome.ok ? 'success' : 'error'}>{outcome.message}</Callout>
      )}

      <p className="field__hint">
        Hold the tag 0–5 mm from the back of the phone; Chrome may ask for an NFC permission
        the first time.
      </p>
    </div>
  )
}
