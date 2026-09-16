import { describe, expect, it } from 'vitest'
import {
  DISTRICTS,
  LOT_DISTRIBUTION,
  LOTS,
  SHOP_DRAWS,
  SHOP_TYPES,
  STARTING_CASH,
} from '../shared/gameData.js'
import {
  advanceAfterIncome,
  adjacentLotIds,
  calculateIncome,
  commitLotSelection,
  createLots,
  createShopBag,
  emptyTileCounts,
  executeTrade,
  rankPlayers,
  startRound,
  validateTrade,
} from './gameEngine.js'

function player(id, name = id) {
  return {
    id,
    name,
    colorId: 'red',
    cash: STARTING_CASH,
    tiles: emptyTileCounts(),
    lotChoices: [],
    keptLots: [],
  }
}

function roomWithPlayers(count = 3) {
  const players = Array.from({ length: count }, (_, index) => player(`p${index + 1}`))
  return {
    players,
    firstPlayerId: players[0].id,
    phase: 'lobby',
    round: 1,
    lots: createLots(),
    shopBag: createShopBag(() => 0.37),
    offers: [],
    readyPlayerIds: [],
    incomeAckIds: [],
    placementOrder: [],
    placementCursor: 0,
    lastIncome: null,
    log: [],
  }
}

describe('physical component data', () => {
  it('maps all 85 buildings exactly once across six districts', () => {
    expect(DISTRICTS).toHaveLength(6)
    expect(LOTS).toHaveLength(85)
    expect(new Set(LOTS.map((lot) => lot.id)).size).toBe(85)
    expect(DISTRICTS.map((district) => district.lots.length)).toEqual([15, 12, 15, 16, 12, 15])
  })

  it('builds the official 90-tile bag with max size plus three copies per shop', () => {
    const bag = createShopBag(() => 0.5)
    expect(bag).toHaveLength(90)
    for (const shop of SHOP_TYPES) {
      expect(bag.filter((id) => id === shop.id)).toHaveLength(shop.max + 3)
    }
  })

  it('uses the official player-count tables', () => {
    expect(LOT_DISTRIBUTION[3][0]).toEqual({ deal: 7, keep: 5 })
    expect(LOT_DISTRIBUTION[5][5]).toEqual({ deal: 4, keep: 2 })
    expect(SHOP_DRAWS[3]).toEqual([7, 4, 4, 4, 4, 4])
    expect(SHOP_DRAWS[4]).toEqual([6, 3, 3, 3, 3, 3])
    expect(SHOP_DRAWS[5]).toEqual([5, 3, 3, 2, 2, 2])
  })
})

describe('board adjacency and income', () => {
  it('connects orthogonal lots within a district but never across a street', () => {
    expect(adjacentLotIds(1).sort((a, b) => a - b)).toEqual([2, 3])
    expect(adjacentLotIds(15).sort((a, b) => a - b)).toEqual([12, 14])
    expect(adjacentLotIds(15)).not.toContain(16)
    expect(adjacentLotIds(27)).not.toContain(28)
  })

  it('scores complete, incomplete, and oversized connected businesses', () => {
    const room = roomWithPlayers()
    for (const lotId of [43, 44, 45, 46, 50]) {
      room.lots[lotId] = { id: lotId, ownerId: 'p1', shopId: 'photo' }
    }
    room.lots[51] = { id: 51, ownerId: 'p1', shopId: 'factory' }
    const receipt = calculateIncome(room, 'p1')
    expect(receipt.total).toBe(80_000)
    expect(receipt.businesses.map(({ size, complete, income }) => ({ size, complete, income }))).toEqual([
      { size: 3, complete: true, income: 50_000 },
      { size: 2, complete: false, income: 20_000 },
      { size: 1, complete: false, income: 10_000 },
    ])
  })

  it('keeps adjacent matching tiles separate when owners differ', () => {
    const room = roomWithPlayers()
    room.lots[43] = { id: 43, ownerId: 'p1', shopId: 'tea' }
    room.lots[44] = { id: 44, ownerId: 'p2', shopId: 'tea' }
    expect(calculateIncome(room, 'p1').total).toBe(10_000)
    expect(calculateIncome(room, 'p2').total).toBe(10_000)
  })
})

describe('round flow and trades', () => {
  it('deals privately, reveals kept buildings together, and auto-distributes tiles', () => {
    const room = roomWithPlayers(3)
    startRound(room, () => 0.41)
    expect(room.phase).toBe('lot_selection')
    expect(room.players.every((entry) => entry.lotChoices.length === 7)).toBe(true)

    for (const entry of room.players) {
      commitLotSelection(room, entry.id, entry.lotChoices.slice(0, 5))
    }

    expect(room.phase).toBe('trading')
    expect(Object.values(room.lots).filter((lot) => lot.ownerId)).toHaveLength(15)
    expect(room.players.every((entry) => Object.values(entry.tiles).reduce((sum, count) => sum + count, 0) === 7)).toBe(true)
    expect(room.shopBag).toHaveLength(69)
  })

  it('enforces $10,000 cash increments', () => {
    const room = roomWithPlayers()
    room.phase = 'trading'
    expect(() => validateTrade(room, 'p1', 'p2', { cash: 5_000 }, {})).toThrow(/\$10,000/)
    expect(() => validateTrade(room, 'p1', 'p2', { cash: 10_000 }, {})).not.toThrow()
  })

  it('atomically trades cash, loose tiles, and a developed building', () => {
    const room = roomWithPlayers()
    room.phase = 'trading'
    room.lots[43] = { id: 43, ownerId: 'p1', shopId: 'restaurant' }
    room.players[1].tiles.photo = 2
    const offer = {
      fromId: 'p1',
      toId: 'p2',
      give: { cash: 10_000, lots: [43], tiles: {} },
      want: { cash: 0, lots: [], tiles: { photo: 2 } },
    }
    executeTrade(room, offer)
    expect(room.players[0].cash).toBe(40_000)
    expect(room.players[1].cash).toBe(60_000)
    expect(room.players[0].tiles.photo).toBe(2)
    expect(room.players[1].tiles.photo).toBe(0)
    expect(room.lots[43]).toEqual({ id: 43, ownerId: 'p2', shopId: 'restaurant' })
  })

  it('breaks final cash ties by shops on the board', () => {
    const room = roomWithPlayers()
    room.players[0].cash = 500_000
    room.players[1].cash = 500_000
    room.players[2].cash = 450_000
    room.lots[1] = { id: 1, ownerId: 'p1', shopId: 'tea' }
    room.lots[2] = { id: 2, ownerId: 'p2', shopId: 'photo' }
    room.lots[3] = { id: 3, ownerId: 'p2', shopId: 'photo' }
    expect(rankPlayers(room).map((entry) => entry.id)).toEqual(['p2', 'p1', 'p3'])
  })

  it('closes the table after 1970 without starting another round', () => {
    const room = roomWithPlayers()
    room.phase = 'income'
    room.round = 6
    room.players[0].cash = 730_000

    advanceAfterIncome(room, () => {
      throw new Error('A seventh round must never be dealt')
    })

    expect(room.phase).toBe('game_over')
    expect(room.round).toBe(6)
    expect(room.players[0].cash).toBe(730_000)
    expect(room.endedAt).toEqual(expect.any(Number))
  })
})
