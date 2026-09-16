import { Crown, Handshake, WifiOff } from 'lucide-react'
import { PLAYER_COLORS } from '../../shared/gameData.js'
import { formatCash, playerById } from '../utils.js'

export function PlayerBar({ room, onTrade }) {
  const current = room.currentPlacementPlayerId
  return (
    <div className="player-bar" aria-label="Players">
      {room.players.map((player) => {
        const color = PLAYER_COLORS.find((entry) => entry.id === player.colorId)
        const isMe = player.id === room.meId
        const first = player.id === room.firstPlayerId
        const isCurrent = player.id === current
        return (
          <div className={`player-chip ${isMe ? 'is-me' : ''} ${isCurrent ? 'is-current' : ''}`} key={player.id}>
            <span className="player-chip__marker" style={{ '--player-color': color.hex, '--player-ink': color.ink }}>{player.name.slice(0, 1).toUpperCase()}</span>
            <span className="player-chip__info">
              <strong>{player.name}</strong>
              <small>{isMe ? formatCash(player.cash) : `${player.ownedLotCount} lots / ${player.shopCount} shops`}</small>
            </span>
            {first && <Crown size={15} className="first-player-icon" />}
            {!player.connected && <WifiOff size={15} className="muted-icon" />}
            {room.phase === 'trading' && !isMe && (
              <button className="icon-button icon-button--small" onClick={() => onTrade(player.id)} title={`Trade with ${player.name}`}>
                <Handshake size={16} />
              </button>
            )}
            {room.phase === 'trading' && player.ready && <span className="ready-check" title="Ready">OK</span>}
          </div>
        )
      })}
      {room.phase === 'placement' && current && (
        <div className="turn-banner"><span />{playerById(room, current)?.name} is placing shops</div>
      )}
    </div>
  )
}
