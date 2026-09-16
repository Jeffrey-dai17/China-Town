import {
  CASH_STEP,
  DISTRICTS,
  INCOME,
  LOT_BY_ID,
  LOT_DISTRIBUTION,
  LOTS,
  SHOP_BY_ID,
  SHOP_DRAWS,
  SHOP_TYPES,
  TOTAL_ROUNDS,
} from '../shared/gameData.js'

export function shuffle(values, rng = Math.random) {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

export function createShopBag(rng = Math.random) {
  return shuffle(
    SHOP_TYPES.flatMap((shop) => Array.from({ length: shop.max + 3 }, () => shop.id)),
    rng,
  )
}

export function createLots() {
  return Object.fromEntries(LOTS.map(({ id }) => [id, { id, ownerId: null, shopId: null }]))
}

export function emptyTileCounts() {
  return Object.fromEntries(SHOP_TYPES.map(({ id }) => [id, 0]))
}

export function playerOrder(room) {
  const start = Math.max(0, room.players.findIndex((player) => player.id === room.firstPlayerId))
  return [...room.players.slice(start), ...room.players.slice(0, start)].map((player) => player.id)
}

export function startRound(room, rng = Math.random) {
  if (room.round < 1 || room.round > TOTAL_ROUNDS) throw new Error('Invalid round')
  room.phase = 'lot_selection'
  room.readyPlayerIds = []
  room.incomeAckIds = []
  room.placementOrder = []
  room.placementCursor = 0
  room.lastIncome = null
  room.players.forEach((player) => {
    player.lotChoices = []
    player.keptLots = []
  })

  const rules = LOT_DISTRIBUTION[room.players.length]?.[room.round - 1]
  if (!rules) throw new Error('Unsupported player count')

  const availableLots = shuffle(
    LOTS.map(({ id }) => id).filter((id) => !room.lots[id].ownerId),
    rng,
  )
  const order = playerOrder(room)
  for (const playerId of order) {
    const player = room.players.find((entry) => entry.id === playerId)
    player.lotChoices = availableLots.splice(0, rules.deal)
  }
  room.log.push(publicLog(`Round ${room.round} began. Building cards were dealt.`, 'phase'))
}

export function commitLotSelection(room, playerId, selectedLots) {
  const player = room.players.find((entry) => entry.id === playerId)
  const rules = LOT_DISTRIBUTION[room.players.length]?.[room.round - 1]
  if (!player || room.phase !== 'lot_selection') throw new Error('Building selection is closed')
  if (player.keptLots.length) throw new Error('Selection already committed')
  if (!Array.isArray(selectedLots) || selectedLots.length !== rules.keep) {
    throw new Error(`Choose exactly ${rules.keep} buildings`)
  }
  const unique = new Set(selectedLots)
  if (unique.size !== selectedLots.length || selectedLots.some((id) => !player.lotChoices.includes(id))) {
    throw new Error('Invalid building selection')
  }
  player.keptLots = [...selectedLots]

  if (room.players.every((entry) => entry.keptLots.length === rules.keep)) {
    for (const entry of room.players) {
      for (const lotId of entry.keptLots) room.lots[lotId].ownerId = entry.id
      entry.lotChoices = []
    }
    drawShopTiles(room)
    room.phase = 'trading'
    room.readyPlayerIds = []
    room.log.push(publicLog('All building choices were revealed and shop tiles were drawn.', 'phase'))
  }
}

export function drawShopTiles(room) {
  const drawCount = SHOP_DRAWS[room.players.length]?.[room.round - 1]
  if (!drawCount) throw new Error('Invalid shop draw')
  for (const playerId of playerOrder(room)) {
    const player = room.players.find((entry) => entry.id === playerId)
    for (let draw = 0; draw < drawCount; draw += 1) {
      const shopId = room.shopBag.pop()
      if (!shopId) throw new Error('The shop bag is empty')
      player.tiles[shopId] += 1
    }
  }
}

export function normalizeBundle(bundle = {}) {
  const cash = Number(bundle.cash || 0)
  const lots = Array.isArray(bundle.lots) ? [...new Set(bundle.lots.map(Number))] : []
  const tiles = emptyTileCounts()
  for (const shop of SHOP_TYPES) {
    const count = Number(bundle.tiles?.[shop.id] || 0)
    tiles[shop.id] = count
  }
  return { cash, lots, tiles }
}

export function validateBundle(bundle) {
  if (!Number.isSafeInteger(bundle.cash) || bundle.cash < 0 || bundle.cash % CASH_STEP !== 0) {
    throw new Error('Cash must be in $10,000 increments')
  }
  if (bundle.lots.some((id) => !Number.isInteger(id) || !LOT_BY_ID[id])) {
    throw new Error('Trade contains an invalid building')
  }
  for (const count of Object.values(bundle.tiles)) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid shop tile quantity')
  }
}

export function bundleHasAssets(bundle) {
  return bundle.cash > 0 || bundle.lots.length > 0 || Object.values(bundle.tiles).some((count) => count > 0)
}

export function playerOwnsBundle(room, playerId, bundle) {
  const player = room.players.find((entry) => entry.id === playerId)
  if (!player || player.cash < bundle.cash) return false
  if (bundle.lots.some((id) => room.lots[id]?.ownerId !== playerId)) return false
  return SHOP_TYPES.every((shop) => player.tiles[shop.id] >= bundle.tiles[shop.id])
}

export function validateTrade(room, fromId, toId, rawGive, rawWant) {
  if (room.phase !== 'trading') throw new Error('Trades are only allowed during open trading')
  if (fromId === toId) throw new Error('Choose another player')
  if (!room.players.some((player) => player.id === fromId) || !room.players.some((player) => player.id === toId)) {
    throw new Error('Player is no longer at the table')
  }
  const give = normalizeBundle(rawGive)
  const want = normalizeBundle(rawWant)
  validateBundle(give)
  validateBundle(want)
  if (!bundleHasAssets(give) && !bundleHasAssets(want)) throw new Error('Add something to the offer')
  if (!playerOwnsBundle(room, fromId, give)) throw new Error('You no longer own everything in this offer')
  if (want.lots.some((id) => room.lots[id]?.ownerId !== toId)) {
    throw new Error('That player no longer owns a requested building')
  }
  if (SHOP_TYPES.some((shop) => {
    const player = room.players.find((entry) => entry.id === toId)
    return player.tiles[shop.id] < want.tiles[shop.id]
  })) {
    throw new Error('That player no longer holds the requested tiles')
  }
  return { give, want }
}

function transferBundle(room, bundle, fromId, toId) {
  const from = room.players.find((player) => player.id === fromId)
  const to = room.players.find((player) => player.id === toId)
  from.cash -= bundle.cash
  to.cash += bundle.cash
  for (const lotId of bundle.lots) room.lots[lotId].ownerId = toId
  for (const shop of SHOP_TYPES) {
    from.tiles[shop.id] -= bundle.tiles[shop.id]
    to.tiles[shop.id] += bundle.tiles[shop.id]
  }
}

export function executeTrade(room, offer) {
  const { give, want } = validateTrade(room, offer.fromId, offer.toId, offer.give, offer.want)
  if (!playerOwnsBundle(room, offer.toId, want)) throw new Error('The requested assets are no longer available')
  transferBundle(room, give, offer.fromId, offer.toId)
  transferBundle(room, want, offer.toId, offer.fromId)
  return { give, want }
}

export function startPlacement(room) {
  if (room.phase !== 'trading') throw new Error('Trading is not active')
  room.phase = 'placement'
  room.readyPlayerIds = []
  room.placementOrder = playerOrder(room)
  room.placementCursor = 0
  for (const offer of room.offers) {
    if (offer.status === 'pending') offer.status = 'expired'
  }
  room.log.push(publicLog('Trading closed. Shop placement began.', 'phase'))
}

export function placeShop(room, playerId, lotId, shopId) {
  if (room.phase !== 'placement') throw new Error('Shop placement is closed')
  if (room.placementOrder[room.placementCursor] !== playerId) throw new Error('It is not your turn')
  const player = room.players.find((entry) => entry.id === playerId)
  const target = room.lots[lotId]
  if (!SHOP_BY_ID[shopId] || !player || player.tiles[shopId] < 1) throw new Error('You do not have that tile')
  if (!target || target.ownerId !== playerId) throw new Error('You can only build on your own property')
  if (target.shopId) throw new Error('A placed shop can never be replaced')
  target.shopId = shopId
  player.tiles[shopId] -= 1
  room.log.push(publicLog(`${player.name} opened ${articleFor(SHOP_BY_ID[shopId].label)} ${SHOP_BY_ID[shopId].label} on building ${lotId}.`, 'build'))
}

export function finishPlacementTurn(room, playerId) {
  if (room.phase !== 'placement' || room.placementOrder[room.placementCursor] !== playerId) {
    throw new Error('It is not your placement turn')
  }
  room.placementCursor += 1
  if (room.placementCursor >= room.placementOrder.length) collectIncome(room)
}

function articleFor(label) {
  return /^[aeiou]/i.test(label) ? 'an' : 'a'
}

export function adjacentLotIds(lotId) {
  const source = LOT_BY_ID[lotId]
  if (!source) return []
  const district = DISTRICTS.find((entry) => entry.id === source.districtId)
  return district.lots
    .filter((candidate) => Math.abs(candidate.row - source.row) + Math.abs(candidate.col - source.col) === 1)
    .map(({ id }) => id)
}

export function calculateIncome(room, playerId) {
  const visited = new Set()
  const businesses = []
  const ownedShopLots = LOTS.map(({ id }) => room.lots[id])
    .filter((entry) => entry.ownerId === playerId && entry.shopId)

  for (const startingLot of ownedShopLots) {
    if (visited.has(startingLot.id)) continue
    const component = []
    const queue = [startingLot.id]
    visited.add(startingLot.id)
    while (queue.length) {
      const lotId = queue.shift()
      component.push(lotId)
      for (const adjacentId of adjacentLotIds(lotId)) {
        const adjacent = room.lots[adjacentId]
        if (
          !visited.has(adjacentId) &&
          adjacent.ownerId === playerId &&
          adjacent.shopId === startingLot.shopId
        ) {
          visited.add(adjacentId)
          queue.push(adjacentId)
        }
      }
    }

    const shop = SHOP_BY_ID[startingLot.shopId]
    let remaining = component.length
    let offset = 0
    while (remaining >= shop.max) {
      const lotIds = component.slice(offset, offset + shop.max)
      businesses.push({ shopId: shop.id, size: shop.max, complete: true, income: INCOME.complete[shop.max], lotIds })
      remaining -= shop.max
      offset += shop.max
    }
    if (remaining > 0) {
      businesses.push({
        shopId: shop.id,
        size: remaining,
        complete: false,
        income: INCOME.incomplete[remaining],
        lotIds: component.slice(offset),
      })
    }
  }

  return {
    total: businesses.reduce((sum, business) => sum + business.income, 0),
    businesses,
  }
}

export function collectIncome(room) {
  room.phase = 'income'
  room.incomeAckIds = []
  room.lastIncome = {}
  for (const player of room.players) {
    const receipt = calculateIncome(room, player.id)
    room.lastIncome[player.id] = receipt
    player.cash += receipt.total
  }
  room.log.push(publicLog(`Income for ${1964 + room.round} was paid.`, 'income'))
}

export function advanceAfterIncome(room, rng = Math.random) {
  if (room.phase !== 'income') throw new Error('Income is not being collected')
  if (room.round === TOTAL_ROUNDS) {
    room.phase = 'game_over'
    room.endedAt = Date.now()
    room.log.push(publicLog('The 1970 books are closed. Final fortunes were revealed.', 'phase'))
    return
  }
  room.round += 1
  startRound(room, rng)
}

export function rankPlayers(room) {
  return room.players
    .map((player) => ({
      id: player.id,
      name: player.name,
      colorId: player.colorId,
      cash: player.cash,
      shopsOnBoard: Object.values(room.lots).filter((lotEntry) => lotEntry.ownerId === player.id && lotEntry.shopId).length,
    }))
    .sort((a, b) => b.cash - a.cash || b.shopsOnBoard - a.shopsOnBoard)
}

export function publicLog(text, type = 'info') {
  return { id: crypto.randomUUID(), text, type, at: Date.now(), audience: null }
}

export function privateLog(text, audience, type = 'trade') {
  return { id: crypto.randomUUID(), text, type, at: Date.now(), audience }
}

export function formatCash(value) {
  return `$${Number(value).toLocaleString('en-US')}`
}
