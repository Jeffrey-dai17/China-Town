import { CalendarDays, Minus, Plus, Trees } from 'lucide-react'
import { useState } from 'react'
import { DISTRICTS, PLAYER_COLORS, SHOP_BY_ID, YEARS } from '../../shared/gameData.js'
import { ShopIcon } from './ShopTile.jsx'

function District({ district, room, selectableLots, selectedLots, onLotClick }) {
  return (
    <section
      className={`district district--${district.id}`}
      style={{ '--district-cols': district.cols }}
      aria-label={`${district.label} district`}
    >
      <span className="district__label"><b>Block {district.id}</b><small>{district.label}</small></span>
      {district.lots.map((lotPosition) => {
        const lot = room.lots[lotPosition.id]
        const owner = room.players.find((player) => player.id === lot.ownerId)
        const ownerColor = PLAYER_COLORS.find((color) => color.id === owner?.colorId)
        const shop = lot.shopId ? SHOP_BY_ID[lot.shopId] : null
        const selectable = selectableLots?.has(lot.id)
        const selected = selectedLots?.has(lot.id)
        const title = shop
          ? `Building ${lot.id}: ${owner?.name || 'Unowned'}'s ${shop.label} (${shop.max} to complete)`
          : `Building ${lot.id}: ${owner?.name || 'Unowned'}`
        return (
          <button
            type="button"
            key={lot.id}
            className={`board-lot ${lot.ownerId ? 'is-owned' : ''} ${lot.shopId ? 'has-shop' : ''} ${selectable ? 'is-selectable' : ''} ${selected ? 'is-selected' : ''}`}
            style={{
              gridColumn: lotPosition.col,
              gridRow: lotPosition.row,
              '--owner-color': ownerColor?.hex || '#6b746f',
              '--owner-ink': ownerColor?.ink || '#ffffff',
              '--shop-color': shop?.color || '#e5e1d8',
            }}
            onClick={() => onLotClick?.(lot.id)}
            title={title}
            aria-label={title}
          >
            <span className="board-lot__number">{lot.id}</span>
            {shop && (
              <span className="board-lot__shop">
                <span className="board-lot__shop-name">{shop.label}</span>
                <span className="board-lot__shop-icon"><ShopIcon shopId={shop.id} size={28} strokeWidth={1.75} /></span>
                <b><small>max</small>{shop.max}</b>
              </span>
            )}
            {owner && <span className="ownership-marker" title={owner.name}>{owner.name.slice(0, 1).toUpperCase()}</span>}
          </button>
        )
      })}
    </section>
  )
}

export function Board({ room, selectableLotIds = [], selectedLotIds = [], onLotClick }) {
  const [zoom, setZoom] = useState(() => typeof window !== 'undefined' && window.innerWidth < 821 ? 0.68 : 0.94)
  const selectableLots = new Set(selectableLotIds)
  const selectedLots = new Set(selectedLotIds)
  const currentYear = YEARS[Math.max(0, room.round - 1)]

  return (
    <div className="board-stage">
      <div className="board-zoom-controls" aria-label="Board zoom">
        <button className="icon-button" onClick={() => setZoom((value) => Math.max(0.56, +(value - 0.12).toFixed(2)))} title="Zoom out"><Minus size={17} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="icon-button" onClick={() => setZoom((value) => Math.min(1.36, +(value + 0.12).toFixed(2)))} title="Zoom in"><Plus size={17} /></button>
      </div>
      <div className="board-scroll">
        <div className="board-scale" style={{ '--board-zoom': zoom }}>
          <div className="city-board">
            <div className="board-map-title" aria-hidden="true"><span>New York City</span><strong>Canal Street Exchange</strong></div>
            <div className="board-street board-street--canal"><span>Canal Street</span></div>
            <div className="districts-row districts-row--north">
              {DISTRICTS.slice(0, 4).map((district) => (
                <District key={district.id} district={district} room={room} selectableLots={selectableLots} selectedLots={selectedLots} onLotClick={onLotClick} />
              ))}
            </div>
            <div className="board-street board-street--division"><span>Mott Street</span><span>Bayard Street</span></div>
            <div className="districts-row districts-row--south">
              <div className="board-park">
                <span><Trees size={22} />Canal Commons</span>
              </div>
              {DISTRICTS.slice(4).map((district) => (
                <District key={district.id} district={district} room={room} selectableLots={selectableLots} selectedLots={selectedLots} onLotClick={onLotClick} />
              ))}
            </div>
            <div className="year-plaza">
              <div className="year-plaza__ring">
                <CalendarDays size={18} />
                <span>Deal year</span>
                <strong>{currentYear?.year}</strong>
              </div>
              <small>Round {room.round} of 6</small>
            </div>
            <div className="board-street board-street--worth"><span>Worth Street</span></div>
            <div className="board-street board-street--bowery"><span>Bowery</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
