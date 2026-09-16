import { useMemo, useState } from 'react'
import { ArrowRight, Building2, Users } from 'lucide-react'
import { PLAYER_COLORS } from '../../shared/gameData.js'

export function Landing({ onCreate, onJoin, connected }) {
  const roomFromUrl = useMemo(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '', [])
  const [mode, setMode] = useState(roomFromUrl ? 'join' : 'create')
  const [name, setName] = useState(() => localStorage.getItem('canal-street-name') || '')
  const [code, setCode] = useState(roomFromUrl)
  const [colorId, setColorId] = useState('red')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    localStorage.setItem('canal-street-name', name.trim())
    const success = mode === 'create'
      ? await onCreate({ name, colorId })
      : await onJoin({ name, code, colorId })
    if (!success) setBusy(false)
  }

  return (
    <main className="landing">
      <div className="landing__wash" />
      <header className="landing__header">
        <div className="wordmark wordmark--light">CHINATOWN</div>
        <div className={`connection-dot ${connected ? 'is-online' : ''}`}>
          <span />{connected ? 'Table online' : 'Connecting'}
        </div>
      </header>

      <section className="landing__content">
        <div className="landing__title">
          <span className="eyebrow">New York / 1965</span>
          <h1>Make the block.<br />Make the deal.</h1>
          <p>Three to five players. Six years. Everything is negotiable.</p>
        </div>

        <form className="entry-panel" onSubmit={submit}>
          <div className="segmented" aria-label="Create or join a table">
            <button type="button" className={mode === 'create' ? 'is-active' : ''} onClick={() => setMode('create')}>
              <Building2 size={17} /> New table
            </button>
            <button type="button" className={mode === 'join' ? 'is-active' : ''} onClick={() => setMode('join')}>
              <Users size={17} /> Join table
            </button>
          </div>

          <label className="field">
            <span>Your name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" placeholder="e.g. Lucy" required />
          </label>

          {mode === 'join' && (
            <label className="field">
              <span>Room code</span>
              <input className="code-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))} maxLength={4} placeholder="ABCD" required />
            </label>
          )}

          <fieldset className="color-field">
            <legend>Marker color</legend>
            <div className="color-swatches">
              {PLAYER_COLORS.map((color) => (
                <button
                  type="button"
                  key={color.id}
                  className={colorId === color.id ? 'is-selected' : ''}
                  style={{ '--swatch': color.hex }}
                  onClick={() => setColorId(color.id)}
                  aria-label={color.label}
                  title={color.label}
                />
              ))}
            </div>
          </fieldset>

          <button className="primary-button primary-button--large" disabled={busy || !connected}>
            {busy ? 'Taking your seat...' : mode === 'create' ? 'Open the table' : 'Take your seat'}
            {!busy && <ArrowRight size={19} />}
          </button>
        </form>
      </section>
    </main>
  )
}
