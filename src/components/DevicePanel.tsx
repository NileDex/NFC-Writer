import type { ReactNode } from 'react'
import { Callout } from './Callout'
import { DevicePicker } from './DevicePicker'
import { LogPanel } from './LogPanel'
import { PhonePanel } from './PhonePanel'
import { ChipIcon, PlugIcon } from './Icons'
import type { DeviceController } from '../hooks/useDevice'
import { useDeviceKind } from '../hooks/useDeviceKind'
import { DEVICE_KINDS } from '../lib/devices'
import type { RecordDraft } from '../lib/payload'

interface DevicePanelProps {
  device: DeviceController
  /** Extra buttons shown next to Connect (Write, Read…). */
  actions?: ReactNode
  /** The live Writer form - lets the phone device write the same record. */
  record?: RecordDraft
  /** Notified after a phone write attempt (serial writes go through device.write). */
  onPhoneOutcome?: (ok: boolean) => void
}

/** Device-kind picker plus the selected writer's controls and shared serial log. */
export function DevicePanel({ device, actions, record, onPhoneOutcome }: DevicePanelProps) {
  const { support, connection, connecting, busy, info } = device
  const kind = useDeviceKind()
  const connected = connection !== null

  return (
    <div className="panel">
      <div className="panel__head">
        <h3>Device</h3>
        {kind === 'microcontroller' && connected && (
          <span className="chip chip--ok">
            <ChipIcon size={12} />
            {connection.portLabel}
          </span>
        )}
      </div>

      <DevicePicker />

      {kind === 'phone' ? (
        <PhonePanel record={record} onOutcome={onPhoneOutcome} />
      ) : kind === 'microcontroller' ? (
        <>
          {!support.ok && <Callout kind="warn">{support.message}</Callout>}

          {support.ok && (
            <>
              <div className="btn-row">
                {connected ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void device.disconnect()}
                    disabled={connecting || busy}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void device.connect()}
                    disabled={connecting}
                  >
                    <PlugIcon />
                    {connecting ? 'Connecting…' : 'Connect'}
                  </button>
                )}
                {actions}
                {connected && (
                  <button type="button" className="btn btn--ghost" onClick={device.clearLog}>
                    Clear log
                  </button>
                )}
              </div>

              {connected && (
                <dl className="kv" style={{ marginTop: 'var(--space-4)' }}>
                  <dt>Firmware</dt>
                  <dd>{info?.fw ?? 'unknown'}</dd>
                  <dt>Protocol</dt>
                  <dd>{info?.proto !== undefined ? `v${info.proto}` : 'unknown'}</dd>
                </dl>
              )}

              {!connected && !connecting && device.log.length === 0 && (
                <p className="field__hint" style={{ marginTop: 'var(--space-3)' }}>
                  Plug in the ESP32, press Connect, pick the serial port (CP2102 / CH340).
                  Hold the tag 0–5 mm above the antenna.
                </p>
              )}

              <div style={{ marginTop: 'var(--space-4)' }}>
                <LogPanel lines={device.log} />
              </div>
            </>
          )}
        </>
      ) : (
        <Callout kind="info">
          <strong>Writer not available yet.</strong> The “
          {DEVICE_KINDS.find((entry) => entry.id === kind)?.label ?? kind}” device isn’t wired
          up - pick Microcontroller or Android / iOS above.
        </Callout>
      )}
    </div>
  )
}
