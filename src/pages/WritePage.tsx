import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDevice } from '../hooks/useDevice'
import { useDeviceKind } from '../hooks/useDeviceKind'
import { useRecordForm } from '../hooks/useRecordForm'
import { Callout } from '../components/Callout'
import { DevicePanel } from '../components/DevicePanel'
import { RecordForm } from '../components/RecordForm'
import { Steps, type Step } from '../components/Steps'

export function WritePage() {
  const form = useRecordForm()
  const device = useDevice()
  const kind = useDeviceKind()
  const [outcome, setOutcome] = useState<
    { ok: true; message: string } | { ok: false; message: string } | null
  >(null)
  const [phoneOk, setPhoneOk] = useState(false)
  // Cards unlock one by one as each step completes and stay unlocked afterwards.
  const [revealed, setRevealed] = useState({ device: false, done: false })

  const connected = device.connection !== null
  const canWrite = connected && form.build.ok && !device.busy
  const byPhone = kind === 'phone'
  const writeDone = byPhone ? phoneOk : outcome?.ok === true

  useEffect(() => {
    setRevealed((prev) => ({
      device: prev.device || form.build.ok,
      done: prev.done || writeDone,
    }))
  }, [form.build.ok, writeDone])

  const flags = byPhone
    ? [form.build.ok, phoneOk]
    : [form.build.ok, connected, outcome?.ok === true]
  const labels = byPhone
    ? ['Compose record', 'Write tag']
    : ['Compose record', 'Connect device', 'Write tag']
  const current = flags.findIndex((flag) => !flag)
  const steps: Step[] = labels.map((label, index) => ({
    label,
    state: flags[index] ? 'done' : current === index ? 'current' : 'todo',
  }))

  const onWrite = async () => {
    setOutcome(null)
    const result = await device.write(form.input)
    if (result.ok) {
      const uid = result.reply.uid ? ` (uid ${result.reply.uid})` : ''
      const bytes = result.reply.bytesUsed ? `, ${result.reply.bytesUsed} bytes` : ''
      setOutcome({
        ok: true,
        message: result.reply.message ?? `Tag written${uid}${bytes}`,
      })
    } else {
      setOutcome({ ok: false, message: result.message })
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Write a tag</h1>
        <p>
          {byPhone
            ? 'Pick what the tag should do, choose a writer device, hold the tag to your phone.'
            : 'Pick what the tag should do, connect the ESP32, hold a blank NTAG, write.'}
        </p>
      </div>

      <div className="wizard">
        <Steps label="Write progress" steps={steps} />

        <div className="wizard__main">
          <section className="panel">
            <div className="panel__head">
              <h3>Compose the record</h3>
              <span className="chip">
                {form.build.bytesUsed ?? 0} / 144 bytes
              </span>
            </div>
            <RecordForm form={form} />
          </section>

          {revealed.device && (
            <div className="reveal">
              <DevicePanel
                device={device}
                record={{ input: form.input, build: form.build }}
                onPhoneOutcome={setPhoneOk}
                actions={
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void onWrite()}
                    disabled={!canWrite}
                  >
                    {device.busy ? 'Waiting for tag…' : 'Write to tag'}
                  </button>
                }
              />
            </div>
          )}

          {outcome && (
            <Callout kind={outcome.ok ? 'success' : 'error'}>{outcome.message}</Callout>
          )}

          {!form.build.ok &&
            form.build.errors.some((error) => form.errorFor(error.field)) && (
              <Callout kind="warn">
                <strong>Fix the form before writing.</strong> {form.build.errors[0].message}
              </Callout>
            )}

          {revealed.done && (
            <section className="panel reveal">
              <div className="panel__head">
                <h3>No ESP32 handy?</h3>
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Generate a standalone sketch with this payload baked in - flash it once, then
                the board writes tags with no computer attached. See the{' '}
                <Link to="/firmware">Firmware page</Link>.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
