import { Check, Copy, Crown, LogOut, Play, WifiOff } from 'lucide-react'
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS } from '../../shared/gameData.js'

export function Lobby({ room, act, onLeave, connected, notify }) {
  const me = room.players.find((player) => player.id === room.meId)
  const isHost = room.hostId === room.meId
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`
  const usedColors = new Set(room.players.map((player) => player.colorId))

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      notify('Invite link copied', 'success')
    } catch {
      notify(`Room code: ${room.code}`, 'success')
    }
  }

  return (
    <main className="lobby">
      <div className="lobby__art" />
      <header className="lobby__header">
        <div className="wordmark wordmark--light">CHINATOWN</div>
        <button className="icon-text-button icon-text-button--light" onClick={onLeave}>
          <LogOut size={17} /> Leave
        </button>
      </header>

      <section className="lobby__sheet">
        <div className="room-heading">
          <div>
            <span className="eyebrow">Your private table</span>
            <h1>Room <strong>{room.code}</strong></h1>
          </div>
          <button className="secondary-button" onClick={copyInvite}><Copy size={17} /> Copy invite</button>
        </div>

        <div className="lobby__body">
          <div className="seat-list">
            <div className="section-title">
              <h2>Players</h2>
              <span>{room.players.length} / {MAX_PLAYERS}</span>
            </div>
            {room.players.map((player, index) => {
              const color = PLAYER_COLORS.find((entry) => entry.id === player.colorId)
              const first = room.firstPlayerId === player.id
              return (
                <div className="seat-row" key={player.id}>
                  <span className="seat-number">{index + 1}</span>
                  <span className="player-marker" style={{ '--player-color': color.hex, '--player-ink': color.ink }}>{player.name.slice(0, 1).toUpperCase()}</span>
                  <div className="seat-row__name">
                    <strong>{player.name}{player.id === me.id ? ' (you)' : ''}</strong>
                    <span>{player.connected ? (player.id === room.hostId ? 'Host' : 'Ready at table') : 'Reconnecting'}</span>
                  </div>
                  {!player.connected && <WifiOff size={17} className="muted-icon" />}
                  {first && <Crown size={18} className="first-player-icon" aria-label="First player" />}
                  {isHost && (
                    <button className={`icon-button ${first ? 'is-active' : ''}`} title="Set as first player" onClick={() => act('lobby:first-player', { playerId: player.id })}>
                      <Crown size={17} />
                    </button>
                  )}
                </div>
              )
            })}
            {Array.from({ length: MAX_PLAYERS - room.players.length }, (_, index) => (
              <div className="seat-row seat-row--empty" key={`empty-${index}`}>
                <span className="seat-number">{room.players.length + index + 1}</span>
                <span className="empty-seat-dot" />
                <span>Waiting for a player...</span>
              </div>
            ))}
          </div>

          <div className="lobby-options">
            <div className="option-block">
              <h2>Your marker</h2>
              <div className="color-swatches color-swatches--large">
                {PLAYER_COLORS.map((color) => {
                  const unavailable = usedColors.has(color.id) && me.colorId !== color.id
                  return (
                    <button
                      type="button"
                      key={color.id}
                      disabled={unavailable}
                      className={me.colorId === color.id ? 'is-selected' : ''}
                      style={{ '--swatch': color.hex }}
                      onClick={() => act('lobby:color', { colorId: color.id })}
                      aria-label={color.label}
                      title={unavailable ? `${color.label} is taken` : color.label}
                    >
                      {me.colorId === color.id && <Check size={16} />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="option-block">
              <h2>First player</h2>
              <p>{room.players.find((player) => player.id === room.firstPlayerId)?.name} gets the First Player card. In person, this is whoever visited a Chinatown most recently.</p>
            </div>

            <div className="start-area">
              {isHost ? (
                <button className="primary-button primary-button--large" disabled={room.players.length < MIN_PLAYERS || !connected} onClick={() => act('lobby:start')}>
                  <Play size={18} fill="currentColor" /> Start game
                </button>
              ) : (
                <div className="waiting-callout"><span className="pulse-dot" /> Waiting for the host to start</div>
              )}
              {isHost && room.players.length < MIN_PLAYERS && <span className="start-hint">Invite {MIN_PLAYERS - room.players.length} more player{MIN_PLAYERS - room.players.length === 1 ? '' : 's'}</span>}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
