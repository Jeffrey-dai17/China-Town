import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { Server } from 'socket.io'
import { createSiteAccess, SITE_ACCESS_COOKIE } from './siteAccess.js'
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  SHOP_TYPES,
  STARTING_CASH,
} from '../shared/gameData.js'
import {
  advanceAfterIncome,
  commitLotSelection,
  createLots,
  createShopBag,
  emptyTileCounts,
  executeTrade,
  finishPlacementTurn,
  formatCash,
  placeShop,
  playerOwnsBundle,
  privateLog,
  publicLog,
  rankPlayers,
  startPlacement,
  startRound,
  validateTrade,
} from './gameEngine.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const app = express()
app.set('trust proxy', 1)
app.use(cors())
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ ok: true }))

const siteAccess = createSiteAccess(process.env.SITE_PASSWORD)
const failedAccessAttempts = new Map()
const accessAttemptWindowMs = 10 * 60 * 1000
const maxAccessAttempts = 8

function accessCookieOptions(request) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.secure,
    path: '/',
    maxAge: siteAccess.ttlMs,
  }
}

function accessAttempt(request) {
  const key = request.ip || request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const previous = failedAccessAttempts.get(key)
  if (!previous || previous.startedAt + accessAttemptWindowMs <= now) {
    const next = { key, startedAt: now, failures: 0 }
    failedAccessAttempts.set(key, next)
    return next
  }
  return { key, ...previous }
}

app.get('/api/access', (request, response) => {
  response.set('Cache-Control', 'no-store')
  response.json({
    required: siteAccess.required,
    authenticated: siteAccess.isAuthorized(request.headers.cookie),
  })
})

app.post('/api/access', (request, response) => {
  response.set('Cache-Control', 'no-store')
  if (!siteAccess.required) {
    response.json({ authenticated: true })
    return
  }

  const attempt = accessAttempt(request)
  if (attempt.failures >= maxAccessAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((attempt.startedAt + accessAttemptWindowMs - Date.now()) / 1000))
    response.set('Retry-After', String(retryAfterSeconds))
    response.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' })
    return
  }

  if (!siteAccess.verifyPassword(request.body?.password)) {
    failedAccessAttempts.set(attempt.key, { startedAt: attempt.startedAt, failures: attempt.failures + 1 })
    response.status(401).json({ error: 'Incorrect password.' })
    return
  }

  failedAccessAttempts.delete(attempt.key)
  response.cookie(SITE_ACCESS_COOKIE, siteAccess.issueToken(), accessCookieOptions(request))
  response.json({ authenticated: true })
})

app.delete('/api/access', (request, response) => {
  response.clearCookie(SITE_ACCESS_COOKIE, { ...accessCookieOptions(request), maxAge: undefined })
  response.json({ authenticated: false })
})

app.use('/api', (request, response, next) => {
  if (siteAccess.isAuthorized(request.headers.cookie)) {
    next()
    return
  }
  response.status(401).json({ error: 'Site password required.' })
})

const distPath = join(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('/{*splat}', (_request, response) => response.sendFile(join(distPath, 'index.html')))
}

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 100_000,
})

io.use((socket, next) => {
  if (siteAccess.isAuthorized(socket.request.headers.cookie)) {
    next()
    return
  }
  const error = new Error('Site password required')
  error.data = { code: 'SITE_ACCESS_REQUIRED' }
  next(error)
})

const rooms = new Map()
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function roomCode() {
  let code
  do {
    code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  } while (rooms.has(code))
  return code
}

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 24)
}

function makePlayer(name, colorId, socketId) {
  return {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    socketId,
    name,
    colorId,
    connected: true,
    cash: STARTING_CASH,
    tiles: emptyTileCounts(),
    lotChoices: [],
    keptLots: [],
  }
}

function makeRoom(host) {
  return {
    code: roomCode(),
    hostId: host.id,
    firstPlayerId: host.id,
    players: [host],
    phase: 'lobby',
    round: 0,
    lots: createLots(),
    shopBag: [],
    offers: [],
    readyPlayerIds: [],
    incomeAckIds: [],
    placementOrder: [],
    placementCursor: 0,
    lastIncome: null,
    log: [publicLog(`${host.name} opened the table.`)],
    createdAt: Date.now(),
    endedAt: null,
  }
}

function sessionFor(room, player) {
  return { roomCode: room.code, playerId: player.id, token: player.token }
}

function serializeRoom(room, viewerId) {
  const revealCash = room.phase === 'game_over'
  const viewer = room.players.find((player) => player.id === viewerId)
  return {
    code: room.code,
    hostId: room.hostId,
    firstPlayerId: room.firstPlayerId,
    phase: room.phase,
    round: room.round,
    meId: viewerId,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      colorId: player.colorId,
      connected: player.connected,
      cash: player.id === viewerId || revealCash ? player.cash : null,
      tiles: player.tiles,
      lotChoices: player.id === viewerId ? player.lotChoices : [],
      keptLots: player.id === viewerId ? player.keptLots : [],
      selectionCommitted: player.keptLots.length > 0,
      ready: room.readyPlayerIds.includes(player.id),
      incomeAcknowledged: room.incomeAckIds.includes(player.id),
      ownedLotCount: Object.values(room.lots).filter((lot) => lot.ownerId === player.id).length,
      shopCount: Object.values(room.lots).filter((lot) => lot.ownerId === player.id && lot.shopId).length,
      income: room.lastIncome?.[player.id]?.total ?? null,
    })),
    lots: room.lots,
    offers: room.offers
      .filter((offer) => offer.fromId === viewerId || offer.toId === viewerId)
      .slice(-40),
    readyPlayerIds: room.readyPlayerIds,
    incomeAckIds: room.incomeAckIds,
    placementOrder: room.placementOrder,
    placementCursor: room.placementCursor,
    currentPlacementPlayerId: room.placementOrder[room.placementCursor] || null,
    lastIncome: viewer ? room.lastIncome?.[viewer.id] ?? null : null,
    shopBagCount: room.shopBag.length,
    log: room.log
      .filter((entry) => !entry.audience || entry.audience.includes(viewerId))
      .slice(-80),
    ranking: revealCash ? rankPlayers(room) : null,
  }
}

function emitRoom(room) {
  for (const player of room.players) {
    if (player.socketId && player.connected) {
      io.to(player.socketId).emit('room:state', serializeRoom(room, player.id))
    }
  }
}

function currentContext(socket) {
  const room = rooms.get(socket.data.roomCode)
  const player = room?.players.find((entry) => entry.id === socket.data.playerId)
  if (!room || !player) throw new Error('You are not seated at a table')
  return { room, player }
}

function reply(ack, payload) {
  if (typeof ack === 'function') ack(payload)
}

function event(socket, name, handler) {
  socket.on(name, async (payload = {}, ack) => {
    try {
      const data = await handler(payload)
      reply(ack, { ok: true, ...data })
    } catch (error) {
      reply(ack, { ok: false, error: error instanceof Error ? error.message : 'Something went wrong' })
    }
  })
}

function joinSocket(socket, room, player) {
  player.connected = true
  player.socketId = socket.id
  socket.data.roomCode = room.code
  socket.data.playerId = player.id
  socket.join(room.code)
}

function bundleSummary(bundle) {
  const parts = []
  if (bundle.cash) parts.push(formatCash(bundle.cash))
  if (bundle.lots.length) parts.push(`building${bundle.lots.length === 1 ? '' : 's'} ${bundle.lots.join(', ')}`)
  for (const shop of SHOP_TYPES) {
    const count = bundle.tiles[shop.id]
    if (count) parts.push(`${count} ${shop.label} tile${count === 1 ? '' : 's'}`)
  }
  return parts.length ? parts.join(', ') : 'nothing'
}

function expireInvalidOffers(room) {
  for (const offer of room.offers) {
    if (offer.status !== 'pending') continue
    try {
      const validated = validateTrade(room, offer.fromId, offer.toId, offer.give, offer.want)
      if (!playerOwnsBundle(room, offer.toId, validated.want)) offer.status = 'expired'
    } catch {
      offer.status = 'expired'
    }
  }
}

io.on('connection', (socket) => {
  event(socket, 'room:create', ({ name, colorId }) => {
    const playerName = cleanName(name)
    if (!playerName) throw new Error('Enter your name')
    const color = PLAYER_COLORS.some((entry) => entry.id === colorId) ? colorId : PLAYER_COLORS[0].id
    const host = makePlayer(playerName, color, socket.id)
    const room = makeRoom(host)
    rooms.set(room.code, room)
    joinSocket(socket, room, host)
    emitRoom(room)
    return { session: sessionFor(room, host) }
  })

  event(socket, 'room:join', ({ code, name, colorId }) => {
    const normalizedCode = String(code || '').trim().toUpperCase()
    const room = rooms.get(normalizedCode)
    const playerName = cleanName(name)
    if (!room) throw new Error('That room code was not found')
    if (room.phase !== 'lobby') throw new Error('That game has already started')
    if (room.players.length >= MAX_PLAYERS) throw new Error('That table is full')
    if (!playerName) throw new Error('Enter your name')
    const usedColors = new Set(room.players.map((player) => player.colorId))
    const requested = PLAYER_COLORS.find((entry) => entry.id === colorId && !usedColors.has(entry.id))
    const color = requested?.id || PLAYER_COLORS.find((entry) => !usedColors.has(entry.id))?.id
    const player = makePlayer(playerName, color, socket.id)
    room.players.push(player)
    room.log.push(publicLog(`${player.name} joined the table.`))
    joinSocket(socket, room, player)
    emitRoom(room)
    return { session: sessionFor(room, player) }
  })

  event(socket, 'room:resume', ({ roomCode: code, playerId, token }) => {
    const room = rooms.get(String(code || '').toUpperCase())
    const player = room?.players.find((entry) => entry.id === playerId && entry.token === token)
    if (!room || !player) throw new Error('That saved seat is no longer available')
    joinSocket(socket, room, player)
    room.log.push(publicLog(`${player.name} reconnected.`))
    emitRoom(room)
    return { session: sessionFor(room, player) }
  })

  event(socket, 'room:leave', () => {
    const { room, player } = currentContext(socket)
    if (room.phase !== 'lobby') throw new Error('Reconnect to your seat if you leave an active game')
    room.players = room.players.filter((entry) => entry.id !== player.id)
    socket.leave(room.code)
    socket.data.roomCode = null
    socket.data.playerId = null
    if (!room.players.length) rooms.delete(room.code)
    else {
      if (room.hostId === player.id) room.hostId = room.players[0].id
      if (room.firstPlayerId === player.id) room.firstPlayerId = room.players[0].id
      room.log.push(publicLog(`${player.name} left the table.`))
      emitRoom(room)
    }
    return {}
  })

  event(socket, 'lobby:color', ({ colorId }) => {
    const { room, player } = currentContext(socket)
    if (room.phase !== 'lobby') throw new Error('Colors are locked after the game starts')
    if (!PLAYER_COLORS.some((entry) => entry.id === colorId)) throw new Error('Unknown color')
    if (room.players.some((entry) => entry.id !== player.id && entry.colorId === colorId)) {
      throw new Error('That color is already taken')
    }
    player.colorId = colorId
    emitRoom(room)
    return {}
  })

  event(socket, 'lobby:first-player', ({ playerId }) => {
    const { room, player } = currentContext(socket)
    if (room.phase !== 'lobby' || player.id !== room.hostId) throw new Error('Only the host can set the first player')
    if (!room.players.some((entry) => entry.id === playerId)) throw new Error('Choose a seated player')
    room.firstPlayerId = playerId
    emitRoom(room)
    return {}
  })

  event(socket, 'lobby:start', () => {
    const { room, player } = currentContext(socket)
    if (room.phase !== 'lobby' || player.id !== room.hostId) throw new Error('Only the host can start')
    if (room.players.length < MIN_PLAYERS) throw new Error('Chinatown needs at least 3 players')
    if (room.players.some((entry) => !entry.connected)) throw new Error('Wait for every player to reconnect')
    room.round = 1
    room.lots = createLots()
    room.shopBag = createShopBag()
    room.offers = []
    room.players.forEach((entry) => {
      entry.cash = STARTING_CASH
      entry.tiles = emptyTileCounts()
      entry.lotChoices = []
      entry.keptLots = []
    })
    const first = room.players.find((entry) => entry.id === room.firstPlayerId)
    room.log.push(publicLog(`${first.name} has the First Player card.`))
    startRound(room)
    emitRoom(room)
    return {}
  })

  event(socket, 'game:choose-lots', ({ lotIds }) => {
    const { room, player } = currentContext(socket)
    commitLotSelection(room, player.id, lotIds)
    emitRoom(room)
    return {}
  })

  event(socket, 'trade:offer', ({ toId, give, want, counterToId = null }) => {
    const { room, player } = currentContext(socket)
    const validated = validateTrade(room, player.id, toId, give, want)
    if (counterToId) {
      const original = room.offers.find((offer) => offer.id === counterToId && offer.toId === player.id && offer.status === 'pending')
      if (!original) throw new Error('That offer can no longer be countered')
      if (original.fromId !== toId) throw new Error('A counteroffer must go back to the original player')
      original.status = 'countered'
    }
    const offer = {
      id: crypto.randomUUID(),
      fromId: player.id,
      toId,
      give: validated.give,
      want: validated.want,
      status: 'pending',
      createdAt: Date.now(),
      counterToId,
    }
    room.offers.push(offer)
    room.readyPlayerIds = []
    const target = room.players.find((entry) => entry.id === toId)
    room.log.push(privateLog(`${player.name} offered ${bundleSummary(offer.give)} for ${bundleSummary(offer.want)}.`, [player.id, toId]))
    room.log.push(publicLog(`${player.name} made ${target.name} an offer.`, 'trade'))
    emitRoom(room)
    return { offerId: offer.id }
  })

  event(socket, 'trade:respond', ({ offerId, response }) => {
    const { room, player } = currentContext(socket)
    const offer = room.offers.find((entry) => entry.id === offerId)
    if (!offer || offer.toId !== player.id || offer.status !== 'pending') throw new Error('That offer is no longer available')
    const sender = room.players.find((entry) => entry.id === offer.fromId)
    if (response === 'decline') {
      offer.status = 'declined'
      room.log.push(privateLog(`${player.name} declined ${sender.name}'s offer.`, [player.id, sender.id]))
    } else if (response === 'accept') {
      const normalized = executeTrade(room, offer)
      offer.give = normalized.give
      offer.want = normalized.want
      offer.status = 'accepted'
      offer.resolvedAt = Date.now()
      room.readyPlayerIds = []
      room.log.push(privateLog(`Deal complete: ${sender.name} gave ${bundleSummary(offer.give)}; ${player.name} gave ${bundleSummary(offer.want)}.`, [player.id, sender.id]))
      room.log.push(publicLog(`${sender.name} and ${player.name} closed a deal.`, 'trade'))
      expireInvalidOffers(room)
    } else {
      throw new Error('Unknown response')
    }
    emitRoom(room)
    return {}
  })

  event(socket, 'trade:cancel', ({ offerId }) => {
    const { room, player } = currentContext(socket)
    const offer = room.offers.find((entry) => entry.id === offerId)
    if (!offer || offer.fromId !== player.id || offer.status !== 'pending') throw new Error('That offer cannot be cancelled')
    offer.status = 'cancelled'
    emitRoom(room)
    return {}
  })

  event(socket, 'trade:ready', ({ ready }) => {
    const { room, player } = currentContext(socket)
    if (room.phase !== 'trading') throw new Error('Trading is not active')
    room.readyPlayerIds = room.readyPlayerIds.filter((id) => id !== player.id)
    if (ready) room.readyPlayerIds.push(player.id)
    if (room.players.every((entry) => room.readyPlayerIds.includes(entry.id))) startPlacement(room)
    emitRoom(room)
    return {}
  })

  event(socket, 'game:place-shop', ({ lotId, shopId }) => {
    const { room, player } = currentContext(socket)
    placeShop(room, player.id, Number(lotId), shopId)
    emitRoom(room)
    return {}
  })

  event(socket, 'game:finish-placement', () => {
    const { room, player } = currentContext(socket)
    finishPlacementTurn(room, player.id)
    emitRoom(room)
    return {}
  })

  event(socket, 'game:ack-income', () => {
    const { room, player } = currentContext(socket)
    if (room.phase !== 'income') throw new Error('There is no income to collect')
    if (!room.incomeAckIds.includes(player.id)) room.incomeAckIds.push(player.id)
    if (room.players.every((entry) => room.incomeAckIds.includes(entry.id))) advanceAfterIncome(room)
    emitRoom(room)
    return {}
  })

  event(socket, 'game:reset', () => {
    const { room, player } = currentContext(socket)
    if (room.phase !== 'game_over' || player.id !== room.hostId) throw new Error('Only the host can reopen the table')
    room.phase = 'lobby'
    room.round = 0
    room.lots = createLots()
    room.shopBag = []
    room.offers = []
    room.readyPlayerIds = []
    room.incomeAckIds = []
    room.placementOrder = []
    room.placementCursor = 0
    room.lastIncome = null
    room.endedAt = null
    room.log = [publicLog(`${player.name} opened a new game at the table.`)]
    room.players.forEach((entry) => {
      entry.cash = STARTING_CASH
      entry.tiles = emptyTileCounts()
      entry.lotChoices = []
      entry.keptLots = []
    })
    emitRoom(room)
    return {}
  })

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode)
    const player = room?.players.find((entry) => entry.id === socket.data.playerId)
    if (!room || !player || player.socketId !== socket.id) return
    player.connected = false
    player.socketId = null
    emitRoom(room)
  })
})

setInterval(() => {
  const staleBefore = Date.now() - 12 * 60 * 60 * 1000
  for (const [code, room] of rooms) {
    const activity = room.endedAt || room.createdAt
    if (activity < staleBefore && room.players.every((player) => !player.connected)) rooms.delete(code)
  }
}, 60 * 60 * 1000).unref()

const port = Number(process.env.PORT || 3001)
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Canal Street game server listening on http://localhost:${port}`)
})
