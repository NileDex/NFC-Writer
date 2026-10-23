import { Link } from 'react-router-dom'
import { Callout } from '../components/Callout'

const PINS: Array<{ signal: string; rc522: string; esp32: string; className?: string }> = [
  { signal: 'Power', rc522: '3.3V', esp32: '3.3V', className: 'pin-power' },
  { signal: 'Ground', rc522: 'GND', esp32: 'GND' },
  { signal: 'Reset', rc522: 'RST', esp32: 'GPIO 22' },
  { signal: 'Chip select', rc522: 'SDA (SS)', esp32: 'GPIO 5' },
  { signal: 'Data out', rc522: 'MISO', esp32: 'GPIO 19' },
  { signal: 'Data in', rc522: 'MOSI', esp32: 'GPIO 23' },
  { signal: 'Clock', rc522: 'SCK', esp32: 'GPIO 18' },
  { signal: 'Interrupt', rc522: 'IRQ', esp32: 'not connected', className: 'pin-nc' },
]

export function SetupPage() {
  return (
    <>
      <div className="page-head">
        <h1>Setup</h1>
        <p>
          An ESP32 Dev Module (~$4), an RC522 reader (~$2), eight female-to-female jumper
          wires, and a blank NTAG213 sticker. Total: about $10.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <Callout kind="warn">
          <strong>Power the RC522 from 3.3V only.</strong> 5V will damage or destroy the
          module - this is the most common way people kill their first reader.
        </Callout>

        <section className="panel">
          <div className="panel__head">
            <h3>Wiring</h3>
            <span className="chip chip--accent">RC522 → ESP32</span>
          </div>
          <table className="pin-table">
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th scope="col">RC522 pin</th>
                <th scope="col">ESP32 pin</th>
              </tr>
            </thead>
            <tbody>
              {PINS.map((pin) => (
                <tr key={pin.signal}>
                  <td>{pin.signal}</td>
                  <td>{pin.rc522}</td>
                  <td className={pin.className}>{pin.esp32}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="field__hint" style={{ marginTop: 'var(--space-3)' }}>
            Matches the universal writer firmware: SPI.begin(18, 19, 23, 5), RST 22,
            SS 5. Adjust the pins in the generated sketch for other boards.
          </p>
        </section>

        <section className="panel panel--flat">
          <div className="panel__head">
            <h3>Step by step</h3>
          </div>
          <div className="how-grid">
            <div className="how-card">
              <div className="how-card__num">
                <span className="step-badge">1</span>
              </div>
              <h3>Wire it up</h3>
              <p>Eight pins on a breadboard - 3.3V ↔ 3.3V, never 5V.</p>
            </div>
            <div className="how-card">
              <div className="how-card__num">
                <span className="step-badge">2</span>
              </div>
              <h3>Plug in USB</h3>
              <p>Data cable only. Windows may need the CP2102 / CH340 driver.</p>
            </div>
            <div className="how-card">
              <div className="how-card__num">
                <span className="step-badge">3</span>
              </div>
              <h3>Flash &amp; write</h3>
              <p>
                Flash from the <Link to="/flash">Flash page</Link>, then write your first
                tag.
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <h3 style={{ marginBottom: 'var(--space-3)' }}>What tags work?</h3>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            Any NFC Forum <strong>Type 2 Tag</strong>: NTAG213 (144 bytes), NTAG215
            (504), NTAG216 (888), MIFARE Ultralight and bulk NTAG213 stickers. The RC522
            cannot handle Type 4 cards, NTAG I²C, or 125 kHz tags.
          </p>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Avoid “programming-locked” tags - the Writer reports{' '}
            <span className="mono">tag_locked</span> when a tag refuses writes.
          </p>
        </section>
      </div>
    </>
  )
}
