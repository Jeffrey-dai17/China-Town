import { useState } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'

export function AccessGate({ onUnlock, initialError = '' }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onUnlock(password)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to unlock the table.')
      setBusy(false)
    }
  }

  return (
    <main className='access-screen'>
      <div className='access-screen__wash' />
      <header className='access-screen__header'>
        <div className='wordmark wordmark--light'>CHINATOWN</div>
        <div className='access-screen__private'><LockKeyhole size={14} /> Private game</div>
      </header>

      <section className='access-screen__content'>
        <form className='access-card' onSubmit={submit}>
          <div className='access-card__seal'><LockKeyhole size={24} /></div>
          <span className='eyebrow'>CSU Boardgame Room</span>
          <h1>Welcome to the table.</h1>
          <p>Enter the shared room password to continue.</p>

          <label className='field'>
            <span>Room password</span>
            <input
              type='password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete='current-password'
              autoFocus
              required
            />
          </label>

          {error && <div className='access-card__error' role='alert'>{error}</div>}

          <button className='primary-button primary-button--large' disabled={busy || !password}>
            {busy ? 'Unlocking...' : 'Enter the room'}
            {!busy && <ArrowRight size={19} />}
          </button>
        </form>
      </section>
    </main>
  )
}
