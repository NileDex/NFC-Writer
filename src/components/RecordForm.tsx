import { RECORD_TYPES } from '../lib/payload'
import type { WifiSecurity } from '../lib/ndef'
import { PayloadMeter } from './PayloadMeter'
import type { RecordFormController } from '../hooks/useRecordForm'

interface RecordFormProps {
  form: RecordFormController
}

/** Segmented record-type picker + the fields for the selected type. */
export function RecordForm({ form }: RecordFormProps) {
  const { state, setType, set, touch, build, errorFor } = form
  const active = RECORD_TYPES.find((r) => r.id === state.type)

  return (
    <div className="form-grid">
      <div className="field">
        <span className="field__label" id="record-type-label">
          What should the tag do?
        </span>
        <div className="seg" role="group" aria-labelledby="record-type-label">
          {RECORD_TYPES.map((record) => (
            <button
              key={record.id}
              type="button"
              aria-pressed={state.type === record.id}
              onClick={() => setType(record.id)}
            >
              {record.label}
            </button>
          ))}
        </div>
        {active && <p className="field__hint">{active.hint}</p>}
      </div>

      {state.type === 'url' && (
        <div className="field">
          <label className="field__label" htmlFor="field-url">
            URL
          </label>
          <input
            id="field-url"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="example.com/menu"
            value={state.url}
            onChange={(e) => set('url', e.target.value)}
            onBlur={() => touch('url')}
            aria-invalid={errorFor('url') ? true : undefined}
            aria-describedby={errorFor('url') ? 'error-url' : undefined}
          />
          {errorFor('url') && (
            <span className="field__error" id="error-url">
              {errorFor('url')}
            </span>
          )}
        </div>
      )}

      {state.type === 'text' && (
        <div className="field">
          <label className="field__label" htmlFor="field-text">
            Text
          </label>
          <textarea
            id="field-text"
            className="textarea"
            placeholder="Table 4 is reserved for the 8pm seating"
            value={state.text}
            onChange={(e) => set('text', e.target.value)}
            onBlur={() => touch('text')}
            aria-invalid={errorFor('text') ? true : undefined}
            aria-describedby={errorFor('text') ? 'error-text' : 'hint-text'}
          />
          {errorFor('text') ? (
            <span className="field__error" id="error-text">
              {errorFor('text')}
            </span>
          ) : (
            <span className="field__hint" id="hint-text">
              Shown as plain text when the tag is tapped.
            </span>
          )}
        </div>
      )}

      {state.type === 'wifi' && (
        <>
          <div className="field">
            <label className="field__label" htmlFor="field-ssid">
              Network name (SSID)
            </label>
            <input
              id="field-ssid"
              className="input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cafe_Guest"
              value={state.ssid}
              onChange={(e) => set('ssid', e.target.value)}
              onBlur={() => touch('ssid')}
              aria-invalid={errorFor('ssid') ? true : undefined}
              aria-describedby={errorFor('ssid') ? 'error-ssid' : undefined}
            />
            {errorFor('ssid') && (
              <span className="field__error" id="error-ssid">
                {errorFor('ssid')}
              </span>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="field-security">
              Security
            </label>
            <select
              id="field-security"
              className="select"
              value={state.security}
              onChange={(e) => set('security', e.target.value as WifiSecurity)}
            >
              <option value="wpa">WPA/WPA2/WPA3</option>
              <option value="wep">WEP</option>
              <option value="open">Open (no password)</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="field-password">
              Password
            </label>
            <input
              id="field-password"
              className="input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={state.security === 'open' ? 'Not needed for open networks' : 'hunter2hunter2'}
              value={state.password}
              onChange={(e) => set('password', e.target.value)}
              onBlur={() => touch('password')}
              disabled={state.security === 'open'}
              aria-invalid={errorFor('password') ? true : undefined}
              aria-describedby={errorFor('password') ? 'error-password' : 'hint-password'}
            />
            {errorFor('password') ? (
              <span className="field__error" id="error-password">
                {errorFor('password')}
              </span>
            ) : (
              <span className="field__hint" id="hint-password">
                Android offers to join on tap; iPhones ignore Wi-Fi records.
              </span>
            )}
          </div>
        </>
      )}

      {state.type === 'phone' && (
        <div className="field">
          <label className="field__label" htmlFor="field-number">
            Phone number
          </label>
          <input
            id="field-number"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 555 010 0100"
            value={state.number}
            onChange={(e) => set('number', e.target.value)}
            onBlur={() => touch('number')}
            aria-invalid={errorFor('number') ? true : undefined}
            aria-describedby={errorFor('number') ? 'error-number' : undefined}
          />
          {errorFor('number') && (
            <span className="field__error" id="error-number">
              {errorFor('number')}
            </span>
          )}
        </div>
      )}

      {state.type === 'email' && (
        <div className="field">
          <label className="field__label" htmlFor="field-email">
            Email address
          </label>
          <input
            id="field-email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="hello@example.com"
            value={state.email}
            onChange={(e) => set('email', e.target.value)}
            onBlur={() => touch('email')}
            aria-invalid={errorFor('email') ? true : undefined}
            aria-describedby={errorFor('email') ? 'error-email' : undefined}
          />
          {errorFor('email') && (
            <span className="field__error" id="error-email">
              {errorFor('email')}
            </span>
          )}
        </div>
      )}

      <PayloadMeter build={build} />

      {errorFor('payload') && <p className="field__error">{errorFor('payload')}</p>}
    </div>
  )
}
