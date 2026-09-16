import { SHOP_TYPES } from '../shared/gameData.js'

export const formatCash = (value) => `$${Number(value || 0).toLocaleString('en-US')}`
export const formatCashShort = (value) => `$${Number(value || 0) / 1000}k`

export function blankBundle() {
  return {
    cash: 0,
    lots: [],
    tiles: Object.fromEntries(SHOP_TYPES.map((shop) => [shop.id, 0])),
  }
}

export function assetCount(bundle) {
  return (
    (bundle.cash ? 1 : 0) +
    bundle.lots.length +
    Object.values(bundle.tiles).reduce((sum, count) => sum + count, 0)
  )
}

export function bundleSummary(bundle) {
  const parts = []
  if (bundle.cash) parts.push(formatCash(bundle.cash))
  if (bundle.lots.length) parts.push(`${bundle.lots.length} building${bundle.lots.length === 1 ? '' : 's'}`)
  const tileCount = Object.values(bundle.tiles).reduce((sum, count) => sum + count, 0)
  if (tileCount) parts.push(`${tileCount} tile${tileCount === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' + ') : 'Nothing'
}

export function playerById(room, id) {
  return room.players.find((player) => player.id === id)
}
