import { Link } from 'react-router-dom'
import { shortErrorLabel } from '../lib/protocol'

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'The Connect button does nothing / no serial port appears',
    a: (
      <>
        <p>
          Web Serial only works in desktop Chrome or Edge (version 89+) on Windows, macOS
          or Linux - not Firefox, Safari, or phones. You also need a{' '}
          <strong>data</strong> USB cable; charge-only cables never show a port.
        </p>
        <p>
          On Windows, install the USB driver for your board (CP2102 or CH340 - Google your
          board&apos;s chip). Close the Arduino IDE Serial Monitor and any other terminal:
          only one program can hold a port.
        </p>
      </>
    ),
  },
  {
    q: '“No tag was detected” every time',
    a: (
      <p>
        Lay the tag flat on the RC522 antenna - usually 0–5 mm above it - and hold it
        still for the full countdown. Thick plastic cases, metal surfaces, and other tags
        stacked underneath interfere with the field. Try a different tag to rule out a
        dead sticker.
      </p>
    ),
  },
  {
    q: 'The tag was found but the write fails or reports locked',
    a: (
      <p>
        Some purchased tags ship password-protected or with locked sectors. The firmware
        reports <span className="mono">tag_locked</span> for these. Cheap bulk NTAG213
        stickers are almost always writable. If writes fail intermittently, keep the tag
        perfectly still and try again - movement during the write corrupts pages.
      </p>
    ),
  },
  {
    q: '“Unsupported tag” - what tags work?',
    a: (
      <p>
        NFC Forum Type 2 tags: NTAG213/215/216 and MIFARE Ultralight. The RC522 cannot
        write Type 4 cards, NTAG I²C, or any 125 kHz tag (HID, EM4100, T5577). See{' '}
        <Link to="/setup">Setup</Link> for details.
      </p>
    ),
  },
  {
    q: '“The payload does not fit on this tag”',
    a: (
      <p>
        An NTAG213 holds 144 bytes of user memory (including the TLV overhead). Long URLs
        and Wi-Fi passwords with long SSIDs are the usual culprits - shorten the content,
        or buy NTAG215/216 tags, which hold 504 / 888 bytes.
      </p>
    ),
  },
  {
    q: 'Does the Wi-Fi record work on iPhone?',
    a: (
      <p>
        No - Apple restricts Wi-Fi joining to a proprietary format. Android scans the WSC
        record this tool writes and offers to join the network on tap. On iPhone the tag
        simply opens as a text/MIME record.
      </p>
    ),
  },
  {
    q: 'Can I use this without a computer attached?',
    a: (
      <p>
        Yes - that&apos;s Method B. Generate a standalone sketch on the{' '}
        <Link to="/firmware">Firmware page</Link> with the payload baked in, flash it once,
        and the board writes the same record to every tag presented to it. No serial
        connection needed afterwards.
      </p>
    ),
  },
  {
    q: 'Flashing fails at “syncing with the chip”',
    a: (
      <p>
        Hold the <strong>BOOT</strong> button (GPIO0) while you press Flash, then release
        it once syncing starts. Use a short data cable in a direct port, avoid unpowered
        hubs, and close other serial tools. Full checklist appears under the flash log
        when it fails.
      </p>
    ),
  },
  {
    q: 'Where does my data go?',
    a: (
      <p>
        Nowhere. Everything - payload encoding, firmware generation, USB flashing - runs
        in your browser. There is no server, no account, and no analytics. The{' '}
        <code>public/_redirects</code> file is just static hosting config.
      </p>
    ),
  },
]

const ERROR_CODES = [
  'tag_not_found',
  'tag_locked',
  'unsupported_tag',
  'payload_too_large',
  'write_failed',
  'read_failed',
  'bad_request',
  'bad_reply',
  'timeout',
  'no_device',
]

export function HelpPage() {
  return (
    <>
      <div className="page-head">
        <h1>Troubleshooting</h1>
        <p>The fixes we see most, plus what every device error code means.</p>
      </div>

      <section className="faq">
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <div className="faq__body">{item.a}</div>
          </details>
        ))}
      </section>

      <section className="panel section-gap">
        <div className="panel__head">
          <h3>Device error codes</h3>
        </div>
        <table className="pin-table">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Label</th>
            </tr>
          </thead>
          <tbody>
            {ERROR_CODES.map((code) => (
              <tr key={code}>
                <td className="mono">{code}</td>
                <td>{shortErrorLabel(code)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field__hint" style={{ marginTop: 'var(--space-3)' }}>
          The Writer and Reader show the full plain-language explanation inline when a
          command fails - the codes above are what the firmware sends over serial.
        </p>
      </section>
    </>
  )
}
