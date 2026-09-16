import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001'
const sitePassword = process.env.SITE_PASSWORD || ''
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const outputDir = '.artifacts'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const errors = []

async function unlockIfNeeded(page) {
  const passwordInput = page.getByLabel('Room password')
  if (await passwordInput.count() === 0) return
  if (!sitePassword) throw new Error('This site requires SITE_PASSWORD for the smoke test')
  await passwordInput.fill(sitePassword)
  await page.getByRole('button', { name: 'Enter the room' }).click()
  await page.getByLabel('Your name').waitFor()
}

let passwordScreenshots = 0
if (sitePassword) {
  const accessContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const accessPage = await accessContext.newPage()
  await accessPage.goto(baseUrl, { waitUntil: 'networkidle' })
  await accessPage.getByLabel('Room password').waitFor()
  await accessPage.screenshot({ path: `${outputDir}/access-desktop.png`, fullPage: true })
  await accessPage.getByLabel('Room password').fill('definitely-wrong')
  await accessPage.getByRole('button', { name: 'Enter the room' }).click()
  const accessError = await accessPage.getByRole('alert').textContent()
  if (!accessError?.includes('Incorrect password')) throw new Error('Wrong site password was not rejected')
  await accessContext.close()
  passwordScreenshots = 1
}

async function makePlayer(name, joinCode = null, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${name}: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`))
  await page.goto(joinCode ? `${baseUrl}/?room=${joinCode}` : baseUrl, { waitUntil: 'networkidle' })
  await unlockIfNeeded(page)
  await page.getByLabel('Your name').fill(name)
  if (joinCode) await page.getByRole('button', { name: 'Take your seat' }).click()
  else await page.getByRole('button', { name: 'Open the table' }).click()
  await page.locator('.lobby__sheet').waitFor()
  return { context, page }
}

async function chooseLots(page, count) {
  await page.locator('.deed-cards button').first().waitFor()
  const cards = page.locator('.deed-cards button')
  for (let index = 0; index < count; index += 1) await cards.nth(index).click()
  await page.getByRole('button', { name: new RegExp(`Lock in ${count} / ${count}`) }).click()
}

const alice = await makePlayer('Alice')
const code = (await alice.page.locator('.room-heading h1 strong').textContent()).trim()
const bob = await makePlayer('Bob', code)
const cara = await makePlayer('Cara', code)

await alice.page.screenshot({ path: `${outputDir}/lobby-desktop.png`, fullPage: true })
await alice.page.getByRole('button', { name: 'Start game' }).click()
await Promise.all([chooseLots(alice.page, 5), chooseLots(bob.page, 5), chooseLots(cara.page, 5)])

await alice.page.getByRole('button', { name: 'Ready to build' }).waitFor()
const lotCount = await alice.page.locator('.board-lot').count()
if (lotCount !== 85) throw new Error(`Expected 85 board lots, found ${lotCount}`)
const lotGeometry = await alice.page.locator('.board-lot').evaluateAll((lots) => {
  const sizes = lots.map((lot) => {
    const style = getComputedStyle(lot)
    return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height) }
  })
  return {
    size: sizes[0],
    allEqualSquares: sizes.every(({ width, height }) =>
      Math.abs(width - height) < 0.01
      && Math.abs(width - sizes[0].width) < 0.01
      && Math.abs(height - sizes[0].height) < 0.01),
  }
})
if (!lotGeometry.allEqualSquares) throw new Error('Every board lot must use the same square dimensions')
if (Math.abs(lotGeometry.size.width - 68) > 0.01 || Math.abs(lotGeometry.size.height - 68) > 0.01) {
  throw new Error(`Every board lot must remain 68x68, got ${JSON.stringify(lotGeometry.size)}`)
}
const fittedBoard = await alice.page.locator('.board-scroll').evaluate((scrollArea) => {
  const board = scrollArea.querySelector('.board-scale').getBoundingClientRect()
  const viewport = scrollArea.getBoundingClientRect()
  return {
    fullyVisible: board.left >= viewport.left - 1
      && board.top >= viewport.top - 1
      && board.right <= viewport.right + 1
      && board.bottom <= viewport.bottom + 1,
    board: { width: board.width, height: board.height },
    viewport: { width: viewport.width, height: viewport.height },
  }
})
if (!fittedBoard.fullyVisible) {
  throw new Error(`Expected fitted board to be fully visible, got ${JSON.stringify(fittedBoard)}`)
}
await alice.page.screenshot({ path: `${outputDir}/trading-desktop.png`, fullPage: true })

await alice.page.getByTitle('Trade with Bob').click()
const editors = alice.page.locator('.bundle-editor')
await editors.nth(0).locator('input[type="number"]').fill('10000')
await editors.nth(0).locator('.lot-token').first().click()
await editors.nth(1).locator('.lot-token').first().click()
await alice.page.getByRole('button', { name: 'Send offer' }).click()

await bob.page.locator('.sidebar-tabs').getByRole('button', { name: /Trades/ }).click()
await bob.page.getByRole('button', { name: 'Accept' }).click()
await Promise.all([
  alice.page.getByRole('button', { name: 'Ready to build' }).click(),
  bob.page.getByRole('button', { name: 'Ready to build' }).click(),
  cara.page.getByRole('button', { name: 'Ready to build' }).click(),
])

await alice.page.getByRole('button', { name: 'Finish placement' }).waitFor()
await alice.page.locator('.sidebar-tabs').getByRole('button', { name: /Hand/ }).click()
await alice.page.locator('.shop-tile:not(:disabled)').first().click()
await alice.page.locator('.board-lot.is-selectable').first().click()
await alice.page.getByRole('button', { name: 'Place shop' }).click()
await alice.page.getByRole('button', { name: 'Finish placement' }).click()
await bob.page.getByRole('button', { name: 'Finish placement' }).click()
await cara.page.getByRole('button', { name: 'Finish placement' }).click()

await alice.page.locator('.income-modal').waitFor()
await alice.page.screenshot({ path: `${outputDir}/income-desktop.png`, fullPage: true })
await Promise.all([
  alice.page.getByRole('button', { name: /Collect & continue/ }).click(),
  bob.page.getByRole('button', { name: /Collect & continue/ }).click(),
  cara.page.getByRole('button', { name: /Collect & continue/ }).click(),
])

await alice.page.locator('.selection-sheet').waitFor()
await alice.page.setViewportSize({ width: 390, height: 844 })
await alice.page.screenshot({ path: `${outputDir}/round-two-mobile.png`, fullPage: true })

const originalAliceSession = await alice.page.evaluate(() => JSON.parse(localStorage.getItem('canal-street-session')))
alice.page.once('dialog', (dialog) => dialog.accept())
await alice.page.getByRole('button', { name: 'Leave this game' }).click()
await alice.page.getByLabel('Your name').waitFor()
const leaveStorage = await alice.page.evaluate(() => ({
  active: localStorage.getItem('canal-street-session'),
  saved: JSON.parse(localStorage.getItem('canal-street-saved-seats')),
}))
if (leaveStorage.active !== null) throw new Error('Leaving an active game must disable automatic restore')
if (leaveStorage.saved?.[code]?.playerId !== originalAliceSession.playerId) {
  throw new Error('Leaving an active game must preserve the saved seat on this browser')
}
await alice.page.reload({ waitUntil: 'networkidle' })
await unlockIfNeeded(alice.page)
await alice.page.getByLabel('Your name').waitFor()
if (await alice.page.locator('.board-stage').count()) throw new Error('An intentional leave must not auto-rejoin after refresh')
await alice.page.getByRole('button', { name: 'Join table' }).click()
await alice.page.getByLabel('Room code').fill(code)
await alice.page.getByRole('button', { name: 'Take your seat' }).click()
await alice.page.locator('.board-stage').waitFor()
const rejoinedAliceSession = await alice.page.evaluate(() => JSON.parse(localStorage.getItem('canal-street-session')))
if (rejoinedAliceSession.playerId !== originalAliceSession.playerId) {
  throw new Error('Entering the room code must restore the same saved player seat')
}

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mobilePage = await mobile.newPage()
await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' })
await unlockIfNeeded(mobilePage)
await mobilePage.screenshot({ path: `${outputDir}/landing-mobile.png`, fullPage: true })
await mobile.close()

for (const player of [alice, bob, cara]) await player.context.close()
await browser.close()

if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`)
console.log(JSON.stringify({ code, lotCount, lotSize: lotGeometry.size, rejoinedPlayer: rejoinedAliceSession.playerId === originalAliceSession.playerId, screenshots: 5 + passwordScreenshots, errors: 0 }))
