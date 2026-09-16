export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 5
export const STARTING_CASH = 50_000
export const CASH_STEP = 10_000
export const TOTAL_ROUNDS = 6

export const PLAYER_COLORS = [
  { id: 'red', label: 'Red', hex: '#d95548', ink: '#fff8ed' },
  { id: 'yellow', label: 'Yellow', hex: '#e2b63b', ink: '#2a2110' },
  { id: 'green', label: 'Green', hex: '#2f8b68', ink: '#f6fff9' },
  { id: 'white', label: 'White', hex: '#eee8dc', ink: '#2b2924' },
  { id: 'purple', label: 'Purple', hex: '#7d62a8', ink: '#fffaff' },
]

export const SHOP_TYPES = [
  { id: 'photo', label: 'Photo', max: 3, color: '#237aa5' },
  { id: 'tea', label: 'Tea House', max: 3, color: '#9d4e36' },
  { id: 'seafood', label: 'Sea Food', max: 3, color: '#168c88' },
  { id: 'jewellery', label: 'Jewellery', max: 4, color: '#a74c77' },
  { id: 'fish', label: 'Tropical Fish', max: 4, color: '#365eaa' },
  { id: 'florist', label: 'Florist', max: 4, color: '#bf5a64' },
  { id: 'takeout', label: 'Take Out', max: 5, color: '#c28b21' },
  { id: 'laundry', label: 'Laundry', max: 5, color: '#526f9d' },
  { id: 'dimsum', label: 'Dim Sum', max: 5, color: '#c7682c' },
  { id: 'antiques', label: 'Antiques', max: 6, color: '#76507f' },
  { id: 'factory', label: 'Factory', max: 6, color: '#4d6266' },
  { id: 'restaurant', label: 'Restaurant', max: 6, color: '#aa3d35' },
]

export const SHOP_BY_ID = Object.fromEntries(SHOP_TYPES.map((shop) => [shop.id, shop]))

export const LOT_DISTRIBUTION = {
  3: [
    { deal: 7, keep: 5 },
    { deal: 6, keep: 4 },
    { deal: 6, keep: 4 },
    { deal: 6, keep: 4 },
    { deal: 6, keep: 4 },
    { deal: 6, keep: 4 },
  ],
  4: [
    { deal: 6, keep: 4 },
    { deal: 5, keep: 3 },
    { deal: 5, keep: 3 },
    { deal: 5, keep: 3 },
    { deal: 5, keep: 3 },
    { deal: 5, keep: 3 },
  ],
  5: [
    { deal: 5, keep: 3 },
    { deal: 5, keep: 3 },
    { deal: 5, keep: 3 },
    { deal: 4, keep: 2 },
    { deal: 4, keep: 2 },
    { deal: 4, keep: 2 },
  ],
}

export const SHOP_DRAWS = {
  3: [7, 4, 4, 4, 4, 4],
  4: [6, 3, 3, 3, 3, 3],
  5: [5, 3, 3, 2, 2, 2],
}

export const INCOME = {
  incomplete: { 1: 10_000, 2: 20_000, 3: 40_000, 4: 60_000, 5: 80_000 },
  complete: { 3: 50_000, 4: 80_000, 5: 110_000, 6: 140_000 },
}

const lot = (id, row, col) => ({ id, row, col })

// The coordinates reproduce the six separate blocks on the physical board.
// Businesses never connect across a street, even when two lots look close.
export const DISTRICTS = [
  {
    id: 1,
    label: 'West Canal',
    cols: 4,
    lots: [
      lot(1, 1, 2), lot(2, 1, 3),
      lot(3, 2, 2), lot(4, 2, 3), lot(5, 2, 4),
      lot(6, 3, 1), lot(7, 3, 2), lot(8, 3, 3), lot(9, 3, 4),
      lot(10, 4, 1), lot(11, 4, 2), lot(12, 4, 3),
      lot(13, 5, 1), lot(14, 5, 2), lot(15, 5, 3),
    ],
  },
  {
    id: 2,
    label: 'Central Canal',
    cols: 3,
    lots: [
      lot(16, 1, 1), lot(17, 1, 2), lot(18, 1, 3),
      lot(19, 2, 1), lot(20, 2, 2), lot(21, 2, 3),
      lot(22, 3, 1), lot(23, 3, 2),
      lot(24, 4, 1), lot(25, 4, 2),
      lot(26, 5, 1), lot(27, 5, 2),
    ],
  },
  {
    id: 3,
    label: 'East Canal',
    cols: 4,
    lots: [
      lot(28, 1, 1), lot(29, 1, 2), lot(30, 1, 3),
      lot(31, 2, 1), lot(32, 2, 2), lot(33, 2, 3),
      lot(34, 3, 1), lot(35, 3, 2), lot(36, 3, 3),
      lot(37, 4, 2), lot(38, 4, 3), lot(39, 4, 4),
      lot(40, 5, 2), lot(41, 5, 3), lot(42, 5, 4),
    ],
  },
  {
    id: 4,
    label: 'Bowery',
    cols: 4,
    lots: [
      lot(43, 1, 1), lot(44, 1, 2), lot(45, 1, 3), lot(46, 1, 4),
      lot(47, 2, 1), lot(48, 2, 2), lot(49, 2, 3), lot(50, 2, 4),
      lot(51, 3, 1), lot(52, 3, 2), lot(53, 3, 3), lot(54, 3, 4),
      lot(55, 4, 3), lot(56, 4, 4),
      lot(57, 5, 3), lot(58, 5, 4),
    ],
  },
  {
    id: 5,
    label: 'West Worth',
    cols: 3,
    lots: [
      lot(59, 1, 1), lot(60, 1, 2),
      lot(61, 2, 1), lot(62, 2, 2),
      lot(63, 3, 1), lot(64, 3, 2), lot(65, 3, 3),
      lot(66, 4, 1), lot(67, 4, 2), lot(68, 4, 3),
      lot(69, 5, 2), lot(70, 5, 3),
    ],
  },
  {
    id: 6,
    label: 'East Worth',
    cols: 4,
    lots: [
      lot(71, 1, 1), lot(72, 1, 2), lot(73, 1, 3), lot(74, 1, 4),
      lot(75, 2, 1), lot(76, 2, 2), lot(77, 2, 3), lot(78, 2, 4),
      lot(79, 3, 1), lot(80, 3, 2), lot(81, 3, 3), lot(82, 3, 4),
      lot(83, 4, 1), lot(84, 4, 2), lot(85, 4, 3),
    ],
  },
]

export const LOTS = DISTRICTS.flatMap((district) =>
  district.lots.map((entry) => ({ ...entry, districtId: district.id })),
)

export const LOT_BY_ID = Object.fromEntries(LOTS.map((entry) => [entry.id, entry]))

export const YEARS = [
  { year: 1965, zodiac: 'Snake' },
  { year: 1966, zodiac: 'Horse' },
  { year: 1967, zodiac: 'Goat' },
  { year: 1968, zodiac: 'Monkey' },
  { year: 1969, zodiac: 'Rooster' },
  { year: 1970, zodiac: 'Dog' },
]

export const PHASE_LABELS = {
  lobby: 'Lobby',
  lot_selection: 'Choose buildings',
  trading: 'Open trading',
  placement: 'Build shops',
  income: 'Collect income',
  game_over: 'Final fortunes',
}
