import { CalendarDays, Maximize2, Minus, Plus, Trees } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { DISTRICTS, PLAYER_COLORS, SHOP_BY_ID, YEARS } from '../../shared/gameData.js'
import { ShopIcon } from './ShopTile.jsx'

const BOARD_WIDTH = 1360
const BOARD_HEIGHT = 960
const MIN_ZOOM = 0.2
const MAX_ZOOM = 1.36

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
  const scrollRef = useRef(null)
  const [zoom, setZoom] = useState(0.94)
  const [fitMode, setFitMode] = useState(true)
  const selectableLots = new Set(selectableLotIds)
  const selectedLots = new Set(selectedLotIds)
  const currentYear = YEARS[Math.max(0, room.round - 1)]

  const fitBoard = useCallback(() => {
    const scrollArea = scrollRef.current
    if (!scrollArea) return
    const styles = window.getComputedStyle(scrollArea)
    const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
    const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    const availableWidth = Math.max(1, scrollArea.clientWidth - horizontalPadding)
    const availableHeight = Math.max(1, scrollArea.clientHeight - verticalPadding)
    const nextZoom = Math.max(MIN_ZOOM, Math.min(1, availableWidth / BOARD_WIDTH, availableHeight / BOARD_HEIGHT))
    setZoom(+nextZoom.toFixed(3))
    setFitMode(true)
    scrollArea.scrollTo({ left: 0, top: 0 })
  }, [])

  useLayoutEffect(() => {
    if (!fitMode) return undefined
    const scrollArea = scrollRef.current
    const frame = window.requestAnimationFrame(fitBoard)
    const observer = new ResizeObserver(fitBoard)
    if (scrollArea) observer.observe(scrollArea)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [fitBoard, fitMode])

  const changeZoom = (amount) => {
    setFitMode(false)
    setZoom((value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(value + amount).toFixed(2))))
  }

  return (
    <div className="board-stage">
      <div className="board-zoom-controls" aria-label="Board zoom">
        <button className="icon-button" onClick={() => changeZoom(-0.12)} title="Zoom out" aria-label="Zoom out"><Minus size={17} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="icon-button" onClick={() => changeZoom(0.12)} title="Zoom in" aria-label="Zoom in"><Plus size={17} /></button>
        <button className={`icon-button board-fit-button ${fitMode ? 'is-active' : ''}`} onClick={fitBoard} title="Fit entire board" aria-label="Fit entire board"><Maximize2 size={16} /></button>
      </div>
      <div className="board-scroll" ref={scrollRef}>
        <div className="board-scale" style={{ '--board-zoom': zoom }}>
          <div className="board-transform">
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
    </div>
  )
}
