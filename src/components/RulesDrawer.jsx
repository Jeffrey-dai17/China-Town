import { X } from 'lucide-react'
import { INCOME, LOT_DISTRIBUTION, SHOP_DRAWS, SHOP_TYPES } from '../../shared/gameData.js'
import { ShopIcon } from './ShopTile.jsx'

export function RulesDrawer({ onClose }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="rules-drawer" role="dialog" aria-modal="true" aria-label="Game rules">
        <header className="modal-header">
          <div><span className="eyebrow">Player aid</span><h2>Rules & payouts</h2></div>
          <button className="icon-button" onClick={onClose} title="Close"><X size={19} /></button>
        </header>

        <div className="rules-drawer__content">
          <section>
            <h3>Round order</h3>
            <ol className="phase-list">
              <li><b>1</b><span><strong>Building cards</strong>Keep the required number, then reveal together.</span></li>
              <li><b>2</b><span><strong>Shop tiles</strong>Draw automatically and reveal together.</span></li>
              <li><b>3</b><span><strong>Trades</strong>Trade buildings, developed buildings, loose tiles, and cash in any combination.</span></li>
              <li><b>4</b><span><strong>Place shops</strong>In order, build any number on vacant buildings you own, or pass.</span></li>
              <li><b>5</b><span><strong>Income</strong>Every business on the board pays.</span></li>
              <li><b>6</b><span><strong>Next year</strong>Continue through 1970.</span></li>
            </ol>
          </section>

          <section>
            <h3>Income</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Size</th>{[1, 2, 3, 4, 5, 6].map((size) => <th key={size}>{size}</th>)}</tr></thead>
                <tbody>
                  <tr><th>Incomplete</th>{[1, 2, 3, 4, 5, 6].map((size) => <td key={size}>{INCOME.incomplete[size] ? `$${INCOME.incomplete[size] / 1000}k` : '-'}</td>)}</tr>
                  <tr><th>Complete</th>{[1, 2, 3, 4, 5, 6].map((size) => <td key={size}>{INCOME.complete[size] ? `$${INCOME.complete[size] / 1000}k` : '-'}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <p>Orthogonally adjacent shops of the same type and owner form one business. When a connected group exceeds its printed maximum, it splits into a complete business plus the remainder.</p>
          </section>

          <section>
            <h3>Cards & tiles</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Players</th>{[1, 2, 3, 4, 5, 6].map((round) => <th key={round}>R{round}</th>)}</tr></thead>
                <tbody>
                  {[3, 4, 5].map((count) => (
                    <tr key={count}>
                      <th>{count}</th>
                      {LOT_DISTRIBUTION[count].map((rule, index) => <td key={index}>{rule.deal}/{rule.keep}<small> / {SHOP_DRAWS[count][index]} tiles</small></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Each cell shows building cards dealt/kept, followed by shop tiles drawn.</p>
          </section>

          <section>
            <h3>Shop set</h3>
            <div className="rules-shop-grid">
              {SHOP_TYPES.map((shop) => <span key={shop.id} style={{ '--shop-color': shop.color }}><i><ShopIcon shopId={shop.id} size={15} /></i>{shop.label}<b>{shop.max}</b></span>)}
            </div>
          </section>

          <section>
            <h3>Rules that matter</h3>
            <ul className="rules-list">
              <li>Placed shop tiles can never move or be removed.</li>
              <li>A developed building can be traded; the shop stays on it and belongs to the new owner.</li>
              <li>Cash is secret and every amount is a multiple of $10,000.</li>
              <li>Loose tiles and vacant buildings are worth nothing at the end.</li>
              <li>Most cash after round 6 wins. Ties go to the player with more shop tiles on the board.</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  )
}
