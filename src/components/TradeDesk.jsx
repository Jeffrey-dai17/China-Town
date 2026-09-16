import { ArrowLeftRight, Check, Minus, Plus, RotateCcw, Send, X } from 'lucide-react'
import { useState } from 'react'
import { CASH_STEP, SHOP_BY_ID, SHOP_TYPES } from '../../shared/gameData.js'
import { assetCount, blankBundle, bundleSummary, formatCash, playerById } from '../utils.js'
import { ShopIcon } from './ShopTile.jsx'

function cloneBundle(bundle) {
  return {
    cash: Number(bundle?.cash || 0),
    lots: [...(bundle?.lots || [])],
    tiles: { ...blankBundle().tiles, ...(bundle?.tiles || {}) },
  }
}

function AssetPillList({ room, bundle }) {
  const parts = []
  if (bundle.cash) parts.push(<span className="asset-pill asset-pill--cash" key="cash">{formatCash(bundle.cash)}</span>)
  for (const lotId of bundle.lots) {
    const shop = room.lots[lotId]?.shopId ? SHOP_BY_ID[room.lots[lotId].shopId] : null
    parts.push(
      <span className="asset-pill" key={`lot-${lotId}`}>
        #{lotId}{shop ? ` / ${shop.label}` : ''}
      </span>,
    )
  }
  for (const shop of SHOP_TYPES) {
    const count = bundle.tiles[shop.id]
    if (count) parts.push(
      <span className="asset-pill" style={{ '--asset-color': shop.color }} key={shop.id}>
        <ShopIcon shopId={shop.id} size={13} /> {count}x {shop.label}
      </span>,
    )
  }
  return parts.length ? <div className="asset-pills">{parts}</div> : <span className="nothing-label">Nothing</span>
}

function BundleEditor({ title, subtitle, room, owner, bundle, setBundle, cashKnown }) {
  const ownedLots = Object.values(room.lots).filter((lot) => lot.ownerId === owner.id)

  const toggleLot = (lotId) => {
    setBundle((current) => ({
      ...current,
      lots: current.lots.includes(lotId) ? current.lots.filter((id) => id !== lotId) : [...current.lots, lotId],
    }))
  }

  const adjustTile = (shopId, delta) => {
    setBundle((current) => ({
      ...current,
      tiles: {
        ...current.tiles,
        [shopId]: Math.max(0, Math.min(owner.tiles[shopId], Number(current.tiles[shopId] || 0) + delta)),
      },
    }))
  }

  return (
    <section className="bundle-editor">
      <div className="bundle-editor__heading">
        <div><h3>{title}</h3><span>{subtitle}</span></div>
        <b>{assetCount(bundle)} selected</b>
      </div>

      <label className="money-field">
        <span>Cash</span>
        <div className="money-input"><span>$</span><input type="number" min="0" step={CASH_STEP} value={bundle.cash || ''} placeholder="0" onChange={(event) => setBundle((current) => ({ ...current, cash: event.target.value }))} /></div>
        <small>{cashKnown ? `${formatCash(owner.cash)} available` : 'In $10,000 increments'}</small>
      </label>

      <div className="asset-group">
        <span className="asset-group__label">Buildings</span>
        <div className="lot-token-grid">
          {ownedLots.length ? ownedLots.map((lot) => {
            const shop = lot.shopId ? SHOP_BY_ID[lot.shopId] : null
            return (
              <button type="button" key={lot.id} className={`lot-token ${bundle.lots.includes(lot.id) ? 'is-selected' : ''}`} onClick={() => toggleLot(lot.id)}>
                <strong>#{lot.id}</strong>
                <span>{shop ? shop.label : 'Vacant'}</span>
              </button>
            )
          }) : <span className="empty-inline">No buildings</span>}
        </div>
      </div>

      <div className="asset-group">
        <span className="asset-group__label">Loose shop tiles</span>
        <div className="tile-stepper-list">
          {SHOP_TYPES.filter((shop) => owner.tiles[shop.id] > 0).map((shop) => {
            const count = Number(bundle.tiles[shop.id] || 0)
            return (
              <div className="tile-stepper" key={shop.id}>
                <span className="tile-stepper__icon" style={{ '--shop-color': shop.color }}><ShopIcon shopId={shop.id} size={16} /></span>
                <span><strong>{shop.label}</strong><small>{owner.tiles[shop.id]} held</small></span>
                <div>
                  <button type="button" className="icon-button icon-button--tiny" onClick={() => adjustTile(shop.id, -1)} disabled={!count}><Minus size={14} /></button>
                  <b>{count}</b>
                  <button type="button" className="icon-button icon-button--tiny" onClick={() => adjustTile(shop.id, 1)} disabled={count >= owner.tiles[shop.id]}><Plus size={14} /></button>
                </div>
              </div>
            )
          })}
          {!SHOP_TYPES.some((shop) => owner.tiles[shop.id] > 0) && <span className="empty-inline">No loose tiles</span>}
        </div>
      </div>
    </section>
  )
}

export function TradeComposer({ room, targetId, counterOffer, act, onClose }) {
  const me = playerById(room, room.meId)
  const target = playerById(room, targetId)
  const [give, setGive] = useStateBundle(counterOffer ? counterOffer.want : null)
  const [want, setWant] = useStateBundle(counterOffer ? counterOffer.give : null)
  const [busy, setBusy] = useState(false)

  if (!target) return null

  const submit = async () => {
    setBusy(true)
    const response = await act('trade:offer', {
      toId: target.id,
      give: { ...give, cash: Number(give.cash || 0) },
      want: { ...want, cash: Number(want.cash || 0) },
      counterToId: counterOffer?.id || null,
    })
    if (response) onClose()
    else setBusy(false)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="trade-modal" role="dialog" aria-modal="true" aria-label={`Trade with ${target.name}`}>
        <header className="modal-header">
          <div><span className="eyebrow">Open negotiation</span><h2>Trade with {target.name}</h2></div>
          <button className="icon-button" onClick={onClose} title="Close"><X size={19} /></button>
        </header>
        <div className="trade-modal__body">
          <BundleEditor title="You give" subtitle={me.name} room={room} owner={me} bundle={give} setBundle={setGive} cashKnown />
          <div className="trade-swap"><ArrowLeftRight size={21} /><span>for</span></div>
          <BundleEditor title="You receive" subtitle={target.name} room={room} owner={target} bundle={want} setBundle={setWant} cashKnown={false} />
        </div>
        <footer className="trade-modal__footer">
          <div className="trade-summary">
            <span>{bundleSummary(give)}</span><ArrowLeftRight size={14} /><span>{bundleSummary(want)}</span>
          </div>
          <button className="primary-button" onClick={submit} disabled={busy || (!assetCount(give) && !assetCount(want))}>
            <Send size={17} /> {busy ? 'Sending...' : counterOffer ? 'Send counter' : 'Send offer'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function useStateBundle(source) {
  return useState(cloneBundle(source || blankBundle()))
}

export function OfferCard({ room, offer, act, onCounter }) {
  const incoming = offer.toId === room.meId
  const other = playerById(room, incoming ? offer.fromId : offer.toId)
  const pending = offer.status === 'pending'
  return (
    <article className={`offer-card offer-card--${offer.status}`}>
      <div className="offer-card__top">
        <div><span>{incoming ? 'From' : 'To'} {other?.name}</span><strong>{pending ? (incoming ? 'New offer' : 'Awaiting reply') : offer.status}</strong></div>
        <time>{new Date(offer.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
      </div>
      <div className="offer-exchange">
        <div><small>{incoming ? 'You receive' : 'You give'}</small><AssetPillList room={room} bundle={offer.give} /></div>
        <ArrowLeftRight size={17} />
        <div><small>{incoming ? 'You give' : 'You receive'}</small><AssetPillList room={room} bundle={offer.want} /></div>
      </div>
      {pending && incoming && (
        <div className="offer-actions">
          <button className="secondary-button" onClick={() => act('trade:respond', { offerId: offer.id, response: 'decline' })}><X size={16} /> Decline</button>
          <button className="secondary-button" onClick={() => onCounter(offer)}><RotateCcw size={16} /> Counter</button>
          <button className="primary-button" onClick={() => act('trade:respond', { offerId: offer.id, response: 'accept' })}><Check size={16} /> Accept</button>
        </div>
      )}
      {pending && !incoming && (
        <div className="offer-actions offer-actions--end">
          <button className="text-button" onClick={() => act('trade:cancel', { offerId: offer.id })}>Withdraw offer</button>
        </div>
      )}
    </article>
  )
}

export function OffersPanel({ room, act, onNewTrade, onCounter }) {
  const pending = room.offers.filter((offer) => offer.status === 'pending')
  const resolved = [...room.offers].filter((offer) => offer.status !== 'pending').reverse().slice(0, 5)
  return (
    <div className="offers-panel">
      <div className="panel-action-row">
        <div><strong>Deal desk</strong><span>{pending.length} active</span></div>
        <button className="primary-button primary-button--small" onClick={onNewTrade}><Plus size={16} /> New offer</button>
      </div>
      <div className="offer-list">
        {pending.map((offer) => <OfferCard key={offer.id} room={room} offer={offer} act={act} onCounter={onCounter} />)}
        {!pending.length && <div className="empty-panel"><ArrowLeftRight size={24} /><strong>No active offers</strong><span>Pick a player to start a deal.</span></div>}
      </div>
      {resolved.length > 0 && (
        <div className="resolved-offers">
          <h3>Recent</h3>
          {resolved.map((offer) => <OfferCard key={offer.id} room={room} offer={offer} act={act} onCounter={onCounter} />)}
        </div>
      )}
    </div>
  )
}
