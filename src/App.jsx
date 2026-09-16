import { useCallback, useEffect, useState } from 'react'
import { AccessGate } from './components/AccessGate.jsx'
import { Landing } from './components/Landing.jsx'
import { Lobby } from './components/Lobby.jsx'
import { GameTable } from './components/GameTable.jsx'
import { emitWithAck, socket } from './socket.js'

const SESSION_KEY = 'canal-street-session'

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
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
        await emitWithAck('room:resume', session)
      } catch {
        localStorage.removeItem(SESSION_KEY)
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
      const response = await emitWithAck(eventName, payload)
      localStorage.setItem(SESSION_KEY, JSON.stringify(response.session))
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
      setRoom(null)
    } catch (error) {
      notify(error.message)
    }
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
    content = <GameTable room={room} act={act} connected={connected} notify={notify} />
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
