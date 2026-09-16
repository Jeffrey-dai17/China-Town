import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Coins,
  Handshake,
  History,
  Inbox,
  Layers3,
  LockKeyhole,
  LogOut,
  Map,
  Trophy,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { LOT_DISTRIBUTION, PHASE_LABELS, PLAYER_COLORS, SHOP_BY_ID, SHOP_TYPES, YEARS } from '../../shared/gameData.js'
import { formatCash, playerById } from '../utils.js'
import { Board } from './Board.jsx'
import { PlayerBar } from './PlayerBar.jsx'
import { RulesDrawer } from './RulesDrawer.jsx'
import { ShopIcon, ShopTile } from './ShopTile.jsx'
import { OffersPanel, TradeComposer } from './TradeDesk.jsx'

export function GameTable(props) {
  return <GameTableView key={props.room.round} {...props} />
}

function GameTableView({ room, act, connected, notify, onLeave }) {
  const me = playerById(room, room.meId)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState(room.phase === 'trading' ? 'trades' : 'hand')
  const [selectedShop, setSelectedShop] = useState(null)
  const [lotSelection, setLotSelection] = useState([])
  const [pendingPlacement, setPendingPlacement] = useState(null)
  const [inspectedLot, setInspectedLot] = useState(null)
  const [tradeTarget, setTradeTarget] = useState(null)
  const [counterOffer, setCounterOffer] = useState(null)
  const [choosingPartner, setChoosingPartner] = useState(false)
  const myPlacementTurn = room.phase === 'placement' && room.currentPlacementPlayerId === room.meId
  const lotRule = LOT_DISTRIBUTION[room.players.length]?.[room.round - 1]

  const openTrade = (playerId) => {
    setCounterOffer(null)
    setTradeTarget(playerId)
  }

  const openCounter = (offer) => {
    setCounterOffer(offer)
    setTradeTarget(offer.fromId)
  }

  const placementLots = selectedShop && myPlacementTurn
    ? Object.values(room.lots).filter((lot) => lot.ownerId === room.meId && !lot.shopId).map((lot) => lot.id)
    : []

  const handleLotClick = (lotId) => {
    if (room.phase === 'lot_selection' && me.lotChoices.includes(lotId) && !me.selectionCommitted) {
      setLotSelection((current) => current.includes(lotId)
        ? current.filter((id) => id !== lotId)
        : current.length < lotRule.keep ? [...current, lotId] : current)
      return
    }
    if (room.phase === 'placement' && selectedShop && placementLots.includes(lotId)) {
      setPendingPlacement({ lotId, shopId: selectedShop })
      return
    }
    setInspectedLot(lotId)
  }

  const confirmPlacement = async () => {
    const placed = await act('game:place-shop', pendingPlacement)
    if (placed && me.tiles[pendingPlacement.shopId] <= 1) setSelectedShop(null)
    setPendingPlacement(null)
  }

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${room.code}`)
      notify('Invite link copied', 'success')
    } catch {
      notify(`Room code: ${room.code}`, 'success')
    }
  }

  return (
    <main className="game-page">
      {!connected && <div className="offline-banner">Connection lost. Your seat is saved while you reconnect.</div>}
      <header className="game-header">
        <div className="game-header__brand">
          <div className="wordmark">CHINATOWN</div>
          <button className="room-code-button" onClick={copyRoom} title="Copy invite link">Room {room.code}</button>
        </div>
        <div className="round-status">
          <span>{YEARS[Math.max(0, room.round - 1)]?.year}</span>
          <ChevronRight size={15} />
          <strong>{PHASE_LABELS[room.phase]}</strong>
        </div>
        <div className="game-header__actions">
          <span className="private-cash"><LockKeyhole size={15} /> {formatCash(me.cash)}</span>
          <button className="icon-button icon-button--danger" onClick={onLeave} title="Leave this game" aria-label="Leave this game"><LogOut size={18} /></button>
          <button className="icon-button" onClick={() => setRulesOpen(true)} title="Rules and payouts"><BookOpen size={19} /></button>
        </div>
      </header>

      <PlayerBar room={room} onTrade={openTrade} />

      <div className="game-layout">
        <section className="board-column">
          <Board
            room={room}
            selectableLotIds={room.phase === 'lot_selection' ? me.lotChoices : placementLots}
            selectedLotIds={room.phase === 'lot_selection' ? lotSelection : pendingPlacement ? [pendingPlacement.lotId] : []}
            onLotClick={handleLotClick}
          />
          <PhaseDock
            room={room}
            me={me}
            selectedShop={selectedShop}
            lotSelection={lotSelection}
            lotRule={lotRule}
            act={act}
          />
        </section>

        <aside className="game-sidebar">
          <nav className="sidebar-tabs">
            <button className={sidebarTab === 'hand' ? 'is-active' : ''} onClick={() => setSidebarTab('hand')}><Layers3 size={17} /> Hand</button>
            <button className={sidebarTab === 'trades' ? 'is-active' : ''} onClick={() => setSidebarTab('trades')}>
              <Handshake size={17} /> Trades
              {room.offers.some((offer) => offer.toId === room.meId && offer.status === 'pending') && <i />}
            </button>
            <button className={sidebarTab === 'log' ? 'is-active' : ''} onClick={() => setSidebarTab('log')}><History size={17} /> Log</button>
          </nav>

          <div className="sidebar-content">
            {sidebarTab === 'hand' && (
              <HandPanel room={room} me={me} selectedShop={selectedShop} setSelectedShop={setSelectedShop} myPlacementTurn={myPlacementTurn} />
            )}
            {sidebarTab === 'trades' && (
              <OffersPanel room={room} act={act} onNewTrade={() => {
                setChoosingPartner(true)
              }} onCounter={openCounter} />
            )}
            {sidebarTab === 'log' && <ActivityLog room={room} />}
          </div>
        </aside>
      </div>

      {room.phase === 'lot_selection' && (
        <LotSelectionSheet room={room} me={me} selected={lotSelection} setSelected={setLotSelection} keepCount={lotRule.keep} act={act} />
      )}
      {room.phase === 'income' && <IncomeModal room={room} me={me} act={act} />}
      {room.phase === 'game_over' && <GameOverModal room={room} act={act} />}
      {pendingPlacement && (
        <ConfirmPlacement room={room} placement={pendingPlacement} onCancel={() => setPendingPlacement(null)} onConfirm={confirmPlacement} />
      )}
      {inspectedLot && (
        <LotInspector room={room} lotId={inspectedLot} onClose={() => setInspectedLot(null)} onTrade={openTrade} />
      )}
      {tradeTarget && (
        <TradeComposer room={room} targetId={tradeTarget} counterOffer={counterOffer} act={act} onClose={() => { setTradeTarget(null); setCounterOffer(null) }} />
      )}
      {choosingPartner && <TradePartnerPicker room={room} onClose={() => setChoosingPartner(false)} onChoose={(playerId) => { setChoosingPartner(false); openTrade(playerId) }} />}
      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
    </main>
  )
}

function PhaseDock({ room, me, selectedShop, act }) {
  if (room.phase === 'trading') {
    return (
      <div className="phase-dock">
        <span><Handshake size={18} /><b>Open trading</b>{room.readyPlayerIds.length} of {room.players.length} ready to build.</span>
        <button className={me.ready ? 'secondary-button' : 'primary-button'} onClick={() => act('trade:ready', { ready: !me.ready })}>
          <Check size={17} /> {me.ready ? 'Stay trading' : 'Ready to build'}
        </button>
      </div>
    )
  }
  if (room.phase === 'placement') {
    const myTurn = room.currentPlacementPlayerId === room.meId
    const current = playerById(room, room.currentPlacementPlayerId)
    return (
      <div className="phase-dock">
        <span><Map size={18} /><b>{myTurn ? 'Your placement turn' : `${current?.name} is building`}</b>{myTurn ? (selectedShop ? `Place a ${SHOP_BY_ID[selectedShop].label} on your vacant lot.` : 'Choose a tile from your hand, or finish.') : 'Placement proceeds clockwise.'}</span>
        {myTurn && <button className="primary-button" onClick={() => act('game:finish-placement')}><ArrowRight size={17} /> Finish placement</button>}
      </div>
    )
  }
  return null
}

function HandPanel({ room, me, selectedShop, setSelectedShop, myPlacementTurn }) {
  const totalTiles = Object.values(me.tiles).reduce((sum, count) => sum + count, 0)
  return (
    <div className="hand-panel">
      <div className="sidebar-section-heading"><div><strong>Your loose tiles</strong><span>{totalTiles} in hand</span></div>{room.phase === 'placement' && !myPlacementTurn && <small>Waiting for your turn</small>}</div>
      <div className="hand-grid">
        {SHOP_TYPES.map((shop) => (
          <ShopTile
            key={shop.id}
            shopId={shop.id}
            count={me.tiles[shop.id]}
            selected={myPlacementTurn && selectedShop === shop.id}
            disabled={!me.tiles[shop.id]}
            interactive={myPlacementTurn && Boolean(me.tiles[shop.id])}
            onClick={() => setSelectedShop((current) => current === shop.id ? null : shop.id)}
          />
        ))}
      </div>
      <div className="public-hands">
        <h3>At the table</h3>
        {room.players.filter((player) => player.id !== room.meId).map((player) => {
          const held = SHOP_TYPES.filter((shop) => player.tiles[shop.id] > 0)
          const color = PLAYER_COLORS.find((entry) => entry.id === player.colorId)
          const looseCount = held.reduce((sum, shop) => sum + player.tiles[shop.id], 0)
          return (
            <div className="public-hand-row" key={player.id}>
              <div className="public-hand-player">
                <span className="public-hand-marker" style={{ '--player-color': color.hex, '--player-ink': color.ink }}>{player.name.slice(0, 1)}</span>
                <span><strong>{player.name}</strong><small>{looseCount} loose tile{looseCount === 1 ? '' : 's'}</small></span>
              </div>
              <div className="public-hand-grid">
                {held.length ? held.map((shop) => (
                  <span className="public-shop-tile" key={shop.id} style={{ '--shop-color': shop.color }} title={`${shop.label}: ${player.tiles[shop.id]} loose, completes at ${shop.max}`}>
                    <span className="public-shop-tile__icon"><ShopIcon shopId={shop.id} size={17} strokeWidth={1.8} /></span>
                    <span>{shop.label}</span>
                    <b>x{player.tiles[shop.id]}</b>
                  </span>
                )) : <small className="public-hand-empty">No loose tiles</small>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityLog({ room }) {
  return (
    <div className="activity-log">
      <div className="sidebar-section-heading"><div><strong>Table log</strong><span>Newest first</span></div></div>
      {[...room.log].reverse().map((entry) => (
        <div className={`log-entry log-entry--${entry.type}`} key={entry.id}>
          <span />
          <div><p>{entry.text}</p><time>{new Date(entry.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>
        </div>
      ))}
    </div>
  )
}

function LotSelectionSheet({ room, me, selected, setSelected, keepCount, act }) {
  if (me.selectionCommitted) {
    return (
      <div className="selection-sheet selection-sheet--waiting">
        <Check size={21} />
        <div><strong>Your buildings are locked in</strong><span>Waiting for {room.players.filter((player) => !player.selectionCommitted).map((player) => player.name).join(', ') || 'the table'}.</span></div>
      </div>
    )
  }
  return (
    <div className="selection-sheet">
      <div className="selection-sheet__heading"><span className="eyebrow">Private draw</span><strong>Keep {keepCount} of these buildings</strong></div>
      <div className="deed-cards">
        {me.lotChoices.map((lotId) => (
          <button key={lotId} className={selected.includes(lotId) ? 'is-selected' : ''} onClick={() => setSelected((current) => current.includes(lotId) ? current.filter((id) => id !== lotId) : current.length < keepCount ? [...current, lotId] : current)}>
            <small>Building</small><strong>{lotId}</strong>{selected.includes(lotId) && <Check size={17} />}
          </button>
        ))}
      </div>
      <button className="primary-button" disabled={selected.length !== keepCount} onClick={() => act('game:choose-lots', { lotIds: selected })}>Lock in {selected.length} / {keepCount}<ChevronRight size={17} /></button>
    </div>
  )
}

function ConfirmPlacement({ placement, onCancel, onConfirm }) {
  const shop = SHOP_BY_ID[placement.shopId]
  return (
    <div className="modal-backdrop">
      <div className="confirm-modal" role="dialog" aria-modal="true">
        <div className="confirm-shop" style={{ '--shop-color': shop.color }}><ShopTile shopId={shop.id} interactive={false} /></div>
        <span className="eyebrow">Building {placement.lotId}</span>
        <h2>Open this {shop.label}?</h2>
        <p>Once placed, this tile stays on building {placement.lotId} for the rest of the game.</p>
        <div className="modal-buttons"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={onConfirm}><Check size={17} /> Place shop</button></div>
      </div>
    </div>
  )
}

function IncomeModal({ room, me, act }) {
  const receipt = room.lastIncome
  const acknowledged = me.incomeAcknowledged
  return (
    <div className="modal-backdrop modal-backdrop--solid">
      <div className="income-modal" role="dialog" aria-modal="true">
        <div className="income-modal__seal"><Coins size={28} /></div>
        <span className="eyebrow">{1964 + room.round} books closed</span>
        <h2>{formatCash(receipt.total)} income</h2>
        <div className="income-lines">
          {receipt.businesses.map((business, index) => {
            const shop = SHOP_BY_ID[business.shopId]
            return <div key={`${business.shopId}-${index}`}><span style={{ '--shop-color': shop.color }}><i />{shop.label} / size {business.size}{business.complete ? ' complete' : ''}</span><strong>{formatCash(business.income)}</strong></div>
          })}
          {!receipt.businesses.length && <div><span>No shops on the board</span><strong>$0</strong></div>}
        </div>
        <div className="income-total"><span>Private balance</span><strong>{formatCash(me.cash)}</strong></div>
        <button className={acknowledged ? 'secondary-button' : 'primary-button'} disabled={acknowledged} onClick={() => act('game:ack-income')}>
          <Check size={17} /> {acknowledged ? `Waiting for ${room.players.length - room.incomeAckIds.length} player${room.players.length - room.incomeAckIds.length === 1 ? '' : 's'}` : room.round === 6 ? 'Reveal final fortunes' : 'Collect & continue'}
        </button>
      </div>
    </div>
  )
}

function GameOverModal({ room, act }) {
  const winner = room.ranking[0]
  const winnerColor = PLAYER_COLORS.find((color) => color.id === winner.colorId)
  const tied = room.ranking.filter((player) => player.cash === winner.cash && player.shopsOnBoard === winner.shopsOnBoard)
  return (
    <div className="modal-backdrop modal-backdrop--solid">
      <div className="game-over-modal" role="dialog" aria-modal="true">
        <Trophy size={31} />
        <span className="eyebrow">1970 / Final fortunes</span>
        <h2>{tied.length > 1 ? 'A shared victory' : `${winner.name} wins`}</h2>
        <p>{formatCash(winner.cash)} and {winner.shopsOnBoard} shops on the board.</p>
        <div className="leaderboard">
          {room.ranking.map((player, index) => {
            const color = PLAYER_COLORS.find((entry) => entry.id === player.colorId)
            return <div key={player.id}><b>{index + 1}</b><span className="player-marker" style={{ '--player-color': color.hex, '--player-ink': color.ink }}>{player.name.slice(0, 1)}</span><strong>{player.name}</strong><span>{player.shopsOnBoard} shops</span><em>{formatCash(player.cash)}</em></div>
          })}
        </div>
        <div className="winner-swatch" style={{ '--winner-color': winnerColor.hex }} />
        {room.hostId === room.meId
          ? <button className={'primary-button play-again-button'} onClick={() => act('game:reset')}>Play another game</button>
          : <span className={'waiting-rematch'}>Waiting for the host to reopen the table</span>}
      </div>
    </div>
  )
}

function TradePartnerPicker({ room, onClose, onChoose }) {
  return (
    <div className={'modal-backdrop'} role={'presentation'} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={'partner-picker'} role={'dialog'} aria-modal={'true'} aria-label={'Choose a trade partner'}>
        <header className={'modal-header'}><div><span className={'eyebrow'}>New offer</span><h2>Choose a player</h2></div><button className={'icon-button'} onClick={onClose} title={'Close'}><X size={18} /></button></header>
        <div className={'partner-picker__list'}>
          {room.players.filter((player) => player.id !== room.meId).map((player) => {
            const color = PLAYER_COLORS.find((entry) => entry.id === player.colorId)
            return <button key={player.id} onClick={() => onChoose(player.id)}><span className={'player-marker'} style={{ '--player-color': color.hex, '--player-ink': color.ink }}>{player.name.slice(0, 1)}</span><span><strong>{player.name}</strong><small>{player.ownedLotCount} lots / {Object.values(player.tiles).reduce((sum, count) => sum + count, 0)} loose tiles</small></span><ChevronRight size={18} /></button>
          })}
        </div>
      </div>
    </div>
  )
}

function LotInspector({ room, lotId, onClose, onTrade }) {
  const lot = room.lots[lotId]
  const owner = playerById(room, lot.ownerId)
  const shop = lot.shopId ? SHOP_BY_ID[lot.shopId] : null
  return (
    <div className="lot-inspector">
      <button className="icon-button icon-button--small" onClick={onClose} title="Close"><X size={15} /></button>
      <span className="eyebrow">Building {lot.id}</span>
      <h3>{shop ? shop.label : 'Vacant property'}</h3>
      <p>{owner ? `Owned by ${owner.name}` : 'Unowned'}{shop ? ` / completes at size ${shop.max}` : ''}</p>
      {room.phase === 'trading' && owner && owner.id !== room.meId && <button className="secondary-button" onClick={() => { onTrade(owner.id); onClose() }}><Inbox size={16} /> Make an offer</button>}
    </div>
  )
}
