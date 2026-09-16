import { SHOP_BY_ID } from '../../shared/gameData.js'
import { FALLBACK_SHOP_ICON, SHOP_ICONS } from '../shopIcons.js'

export function ShopIcon({ shopId, size = 18, strokeWidth = 1.9 }) {
  const Icon = SHOP_ICONS[shopId] || FALLBACK_SHOP_ICON
  return <Icon size={size} strokeWidth={strokeWidth} />
}

export function ShopTile({ shopId, count, selected = false, onClick, disabled = false, compact = false, interactive = true }) {
  const shop = SHOP_BY_ID[shopId]
  if (!shop) return null
  const label = `${shop.label}. Complete at ${shop.max}.${count == null ? '' : ` ${count} loose tile${count === 1 ? '' : 's'} held.`}`
  return (
    <button
      type="button"
      className={`shop-tile ${compact ? 'shop-tile--compact' : ''} ${selected ? 'is-selected' : ''} ${interactive ? '' : 'is-inert'}`}
      style={{ '--shop-color': shop.color }}
      onClick={interactive ? onClick : undefined}
      disabled={disabled}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={!interactive || disabled}
      aria-label={label}
      title={label}
    >
      <span className="shop-tile__label">{shop.label}</span>
      <span className="shop-tile__art" aria-hidden="true">
        <span className="shop-tile__icon"><ShopIcon shopId={shopId} size={compact ? 22 : 31} strokeWidth={1.75} /></span>
      </span>
      <span className="shop-tile__max"><small>Complete</small>{shop.max}</span>
      {count != null && <span className="shop-tile__count">x{count}</span>}
    </button>
  )
}
