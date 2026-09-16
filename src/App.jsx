import { useCallback, useEffect, useState } from 'react'
import { AccessGate } from './components/AccessGate.jsx'
import { Landing } from './components/Landing.jsx'
import { Lobby } from './components/Lobby.jsx'
import { GameTable } from './components/GameTable.jsx'
import { emitWithAck, socket } from './socket.js'

const SESSION_KEY = 'canal-street-session'
const SAVED_SEATS_KEY = 'canal-street-saved-seats'
const MISSING_SEAT_ERROR = 'That saved seat is no longer available'

function ensureSocketConnected() {
  if (socket.connected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('The table did not respond. Check your connection.'))
    }, 7000)
    const cleanup = () => {
      window.clearTimeout(timer)
      socket.off('connect', onConnect)
      socket.off('connect_error', onError)
    }
    const onConnect = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('The table did not respond. Check your connection.'))
    }
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
    socket.connect()
  })
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

function readSavedSeats() {
  try {
    const seats = JSON.parse(localStorage.getItem(SAVED_SEATS_KEY))
    return seats && typeof seats === 'object' && !Array.isArray(seats) ? seats : {}
  } catch {
    return {}
  }
}

function savedSeatFor(roomCode) {
  return readSavedSeats()[String(roomCode || '').trim().toUpperCase()] || null
}

function rememberSavedSeat(session) {
  if (!session?.roomCode || !session?.playerId || !session?.token) return
  const roomCode = String(session.roomCode).toUpperCase()
  const seats = readSavedSeats()
  seats[roomCode] = { ...session, roomCode }
  localStorage.setItem(SAVED_SEATS_KEY, JSON.stringify(seats))
}

function rememberSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  rememberSavedSeat(session)
}

function forgetSavedSeat(roomCode) {
  const normalizedCode = String(roomCode || '').trim().toUpperCase()
  const seats = readSavedSeats()
  if (!seats[normalizedCode]) return
  delete seats[normalizedCode]
  localStorage.setItem(SAVED_SEATS_KEY, JSON.stringify(seats))
}

export default function App() {
  const [siteAccess, setSiteAccess] = useState({ status: 'checking', error: '' })
  const [room, setRoom] = useState(null)
  const [connected, setConnected] = useState(socket.connected)
  const [restoring, setRestoring] = useState(Boolean(readSession()))
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, tone = 'error') => {
    setToast({ message, tone, id: Date.now() })
  }, [])

  useEffect(() => {
    let active = true
    const checkAccess = async () => {
      try {
        const response = await fetch('/api/access', { credentials: 'same-origin', cache: 'no-store' })
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          if (active) setSiteAccess({ status: 'granted', error: '' })
          return
        }
        const result = await response.json()
        if (active) setSiteAccess({ status: result.authenticated ? 'granted' : 'locked', error: '' })
      } catch {
        if (active) setSiteAccess({ status: 'locked', error: 'The game server could not be reached. Try again in a moment.' })
      }
    }
    checkAccess()
    return () => { active = false }
  }, [])

  const unlockSite = async (password) => {
    const response = await fetch('/api/access', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.authenticated) throw new Error(result.error || 'Unable to unlock the table.')
    setSiteAccess({ status: 'granted', error: '' })
  }

  useEffect(() => {
    if (siteAccess.status !== 'granted') return undefined
    const restore = async () => {
      const session = readSession()
      if (!session) {
        setRestoring(false)
        return
      }
      try {
        const response = await emitWithAck('room:resume', session)
        rememberSession(response.session || session)
      } catch (error) {
        localStorage.removeItem(SESSION_KEY)
        if (error.message === MISSING_SEAT_ERROR) forgetSavedSeat(session.roomCode)
        setRoom(null)
      } finally {
        setRestoring(false)
      }
    }
    const onConnect = () => {
      setConnected(true)
      restore()
    }
    const onDisconnect = () => setConnected(false)
    const onConnectError = (error) => {
      if (error?.data?.code !== 'SITE_ACCESS_REQUIRED') return
      socket.disconnect()
      setConnected(false)
      setSiteAccess({ status: 'locked', error: 'Your access expired. Enter the room password again.' })
    }
    const onState = (nextRoom) => setRoom(nextRoom)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('room:state', onState)
    if (!socket.connected) socket.connect()
    else restore()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('room:state', onState)
    }
  }, [siteAccess.status])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const enterRoom = async (eventName, payload) => {
    try {
      await ensureSocketConnected()
      if (eventName === 'room:join') {
        const savedSeat = savedSeatFor(payload.code)
        if (savedSeat) {
          try {
            const response = await emitWithAck('room:resume', savedSeat)
            rememberSession(response.session || savedSeat)
            notify('Welcome back. Your saved seat has been restored.', 'success')
            return true
          } catch (error) {
            if (error.message !== MISSING_SEAT_ERROR) throw error
            forgetSavedSeat(payload.code)
          }
        }
      }
      const response = await emitWithAck(eventName, payload)
      rememberSession(response.session)
      return true
    } catch (error) {
      notify(error.message)
      return false
    }
  }

  const leaveLobby = async () => {
    try {
      await emitWithAck('room:leave')
      localStorage.removeItem(SESSION_KEY)
      forgetSavedSeat(room.code)
      setRoom(null)
    } catch (error) {
      notify(error.message)
    }
  }

  const leaveGame = () => {
    const confirmed = window.confirm(`Leave this game? Your seat will stay saved on this browser. Enter room code ${room.code} to rejoin.`)
    if (!confirmed) return
    rememberSavedSeat(readSession())
    localStorage.removeItem(SESSION_KEY)
    setRoom(null)
    setRestoring(false)
    socket.disconnect()
    socket.connect()
    notify(`You left the game. Enter room code ${room.code} to rejoin your seat.`, 'success')
  }

  const act = useCallback(async (eventName, payload = {}) => {
    try {
      return await emitWithAck(eventName, payload)
    } catch (error) {
      notify(error.message)
      return null
    }
  }, [notify])

  let content
  if (siteAccess.status === 'checking') {
    content = (
      <main className='restore-screen'>
        <div className='restore-mark'>CSU</div>
        <p>Opening the private table...</p>
      </main>
    )
  } else if (siteAccess.status === 'locked') {
    content = <AccessGate onUnlock={unlockSite} initialError={siteAccess.error} />
  } else if (restoring && !room) {
    content = (
      <main className="restore-screen">
        <div className="restore-mark">1965</div>
        <p>Finding your seat...</p>
      </main>
    )
  } else if (!room) {
    content = <Landing onCreate={(payload) => enterRoom('room:create', payload)} onJoin={(payload) => enterRoom('room:join', payload)} connected={connected} />
  } else if (room.phase === 'lobby') {
    content = <Lobby room={room} act={act} onLeave={leaveLobby} connected={connected} notify={notify} />
  } else {
    content = <GameTable room={room} act={act} connected={connected} notify={notify} onLeave={leaveGame} />
  }

  return (
    <>
      {content}
      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status" key={toast.id}>
          {toast.message}
        </div>
      )}
    </>
  )
}
