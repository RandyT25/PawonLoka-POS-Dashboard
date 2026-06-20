import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, TAX_RATE, KITCHEN_STATIONS } from '../shared/constants'
import './customer.css'

// ── Modifier Sheet ───────────────────────────────────────────────────────────

function ModSheet({ product, mods, onAdd }) {
  const [selected, setSelected] = useState({})
  const [note, setNote] = useState('')

  const requiredFilled = mods.filter(m => m.required).every(m => selected[m.id])

  return (
    <div className="cust-modsheet">
      {mods.map(mod => {
        const opts = (mod.options || []).map(o => typeof o === 'string' ? { name: o, price: 0 } : o)
        return (
          <div key={mod.id} className="cust-mod-group">
            <div className="cust-mod-label">
              {mod.name}
              {mod.required && <span className="cust-mod-req"> *</span>}
            </div>
            <div className="cust-mod-opts">
              {opts.map(opt => (
                <button
                  key={opt.name}
                  className={'cust-mod-opt' + (selected[mod.id] === opt.name ? ' active' : '')}
                  onClick={() => setSelected(prev => ({ ...prev, [mod.id]: opt.name }))}
                >
                  {opt.name}{opt.price > 0 && <span className="cust-mod-price"> +{fmt(opt.price)}</span>}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <div className="cust-mod-group">
        <div className="cust-mod-label">Catatan</div>
        <input
          className="cust-mod-note"
          placeholder="mis. tidak pedas, tanpa bawang..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>
      <div className="cust-modsheet-footer">
        <button
          className="cust-btn-primary"
          disabled={!requiredFilled}
          onClick={() => onAdd(product, selected, note)}
        >
          Tambah ke Pesanan
        </button>
      </div>
    </div>
  )
}

// ── Main Customer App ────────────────────────────────────────────────────────

export default function CustomerApp({ tableId }) {
  const [phase, setPhase] = useState('menu') // menu | cart | done | bill
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [modifierGroups, setModifierGroups] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [cart, setCart] = useState([])
  const [modProduct, setModProduct] = useState(null)
  const [openOrder, setOpenOrder] = useState(null)
  const [tableRecord, setTableRecord] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [billRequested, setBillRequested] = useState(false)

  useEffect(() => { load() }, [tableId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: tableData },
        { data: prods },
        { data: cats },
        { data: mods },
      ] = await Promise.all([
        supabase.from('tables').select('*').eq('name', tableId).maybeSingle(),
        supabase.from('products').select('*').eq('active', true),
        supabase.from('categories').select('*').order('sort'),
        supabase.from('modifier_groups').select('*'),
      ])

      setTableRecord(tableData)
      setProducts(prods || [])
      setCategories(cats || [])
      setModifierGroups(mods || [])
      if (cats?.length) setActiveCat(cats[0].name)

      if (tableData?.open_bill_id) {
        const { data: order } = await supabase
          .from('orders').select('*').eq('id', tableData.open_bill_id).maybeSingle()
        if (order?.status === 'Open') {
          setOpenOrder(order)
          setBillRequested(order.bill_requested || false)
        }
      }
    } catch {
      setError('Gagal memuat menu. Coba scan QR lagi.')
    } finally {
      setLoading(false)
    }
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax       = Math.round(subtotal * TAX_RATE)
  const total     = subtotal + tax

  const visibleProducts = activeCat ? products.filter(p => p.cat === activeCat) : products

  function getProductMods(product) {
    if (!product.linked_modifiers?.length) return []
    return modifierGroups.filter(m => product.linked_modifiers.includes(m.id))
  }

  function handleTapProduct(product) {
    const mods = getProductMods(product)
    if (mods.length > 0) setModProduct({ product, mods })
    else addToCart(product, {}, '')
  }

  function addToCart(product, modifiers, note) {
    setModProduct(null)
    const key = product.sku + JSON.stringify(modifiers) + (note || '')
    setCart(prev => {
      const existing = prev.find(i => i._key === key)
      if (existing) return prev.map(i => i._key === key ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, {
        _id: Date.now() + Math.random(), _key: key,
        sku: product.sku, name: product.name,
        price: product.price, cat: product.cat,
        qty: 1, modifiers, note: note || '',
        icon: product.icon, image_url: product.image_url,
      }]
    })
  }

  function updateQty(_id, delta) {
    setCart(prev =>
      prev.map(i => i._id === _id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
    )
  }

  async function handlePlaceOrder() {
    if (cart.length === 0 || ordering) return
    setOrdering(true)
    const now = new Date()
    const getStation = cat => KITCHEN_STATIONS[cat] || 'Kitchen'

    try {
      const orderItems = cart.map(i => ({
        sku: i.sku, name: i.name, qty: i.qty, price: i.price,
        modifiers: i.modifiers || {}, note: i.note || '',
        cat: i.cat || '', _sent: true, _station: getStation(i.cat),
      }))

      let orderId = openOrder?.id

      if (openOrder) {
        const merged = [...(openOrder.items || []), ...orderItems]
        const newSub = merged.reduce((s, i) => s + i.price * i.qty, 0)
        const newTax = Math.round(newSub * TAX_RATE)
        await supabase.from('orders').update({
          items: merged, subtotal: newSub, tax: newTax, total: newSub + newTax,
        }).eq('id', openOrder.id)
        setOpenOrder(prev => ({ ...prev, items: merged, subtotal: newSub, total: newSub + newTax }))
      } else {
        orderId = 'ORD-' + Date.now()
        const { error: e } = await supabase.from('orders').insert({
          id: orderId,
          items: orderItems, subtotal, tax, discount: 0, total,
          pay: '-', staff: 'Self Order', table: tableId,
          customer: null, customer_id: null,
          status: 'Open',
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          cogs: 0,
        })
        if (e) throw e
        await supabase.from('tables').update({ status: 'Occupied', open_bill_id: orderId }).eq('name', tableId)
        const { data: newOrder } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
        setOpenOrder(newOrder)
      }

      // Kitchen tickets per station
      const stations = {}
      cart.forEach(i => {
        const s = getStation(i.cat)
        if (!stations[s]) stations[s] = []
        stations[s].push(i)
      })
      await Promise.all(
        Object.entries(stations).map(([station, items]) =>
          supabase.from('kitchen_tickets').insert({
            id: 'KT-' + crypto.randomUUID(),
            table: tableId,
            items: items.map(i => ({ name: i.name, qty: i.qty, note: i.note || '', modifiers: i.modifiers || {} })),
            time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            status: 'New', station,
          })
        )
      )

      setCart([])
      setPhase('done')
    } catch {
      alert('Gagal mengirim pesanan. Silakan coba lagi.')
    } finally {
      setOrdering(false)
    }
  }

  async function handleRequestBill() {
    if (!openOrder?.id || billRequested) return
    await supabase.from('orders').update({ bill_requested: true }).eq('id', openOrder.id)
    setBillRequested(true)
  }

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="cust-center">
      <div className="cust-spinner" />
      <div className="cust-center-sub">Memuat menu...</div>
    </div>
  )

  if (error || !tableRecord) return (
    <div className="cust-center">
      <div className="cust-center-icon">🍽️</div>
      <div className="cust-center-title">Meja tidak ditemukan</div>
      <div className="cust-center-sub">{error || 'Silakan scan ulang QR code di meja Anda'}</div>
    </div>
  )

  // ── Modifier overlay ─────────────────────────────────────────────────────────

  const modOverlay = modProduct && (
    <div className="cust-overlay" onClick={() => setModProduct(null)}>
      <div className="cust-sheet" onClick={e => e.stopPropagation()}>
        <div className="cust-sheet-hd">
          <div>
            <div className="cust-sheet-title">{modProduct.product.name}</div>
            <div className="cust-sheet-price">{fmt(modProduct.product.price)}</div>
          </div>
          <button className="cust-close-btn" onClick={() => setModProduct(null)}>✕</button>
        </div>
        <ModSheet product={modProduct.product} mods={modProduct.mods} onAdd={addToCart} />
      </div>
    </div>
  )

  // ── Phase: DONE ──────────────────────────────────────────────────────────────

  if (phase === 'done') return (
    <div className="cust-root">
      <div className="cust-center cust-done">
        <div className="cust-center-icon">✅</div>
        <div className="cust-center-title">Pesanan dikirim!</div>
        <div className="cust-center-sub">Dapur sedang menyiapkan pesanan Anda</div>
        <button className="cust-btn-primary" onClick={() => setPhase('bill')}>Lihat Tagihan</button>
        <button className="cust-btn-ghost" onClick={() => setPhase('menu')}>Tambah Pesanan</button>
      </div>
    </div>
  )

  // ── Phase: BILL ──────────────────────────────────────────────────────────────

  if (phase === 'bill') return (
    <div className="cust-root">
      <div className="cust-header">
        <button className="cust-back-btn" onClick={() => setPhase('menu')}>←</button>
        <div className="cust-header-info">
          <div className="cust-header-title">Tagihan Saya</div>
          <div className="cust-header-sub">Meja {tableId}</div>
        </div>
        <div />
      </div>

      <div className="cust-bill">
        {!openOrder ? (
          <div className="cust-empty">Belum ada pesanan</div>
        ) : (
          <>
            <div className="cust-bill-items">
              {(openOrder.items || []).map((item, idx) => (
                <div key={idx} className="cust-bill-row">
                  <div className="cust-bill-name">
                    <span className="cust-bill-qty">{item.qty}×</span> {item.name}
                    {item.modifiers && Object.values(item.modifiers).filter(Boolean).length > 0 && (
                      <div className="cust-bill-mods">{Object.values(item.modifiers).filter(Boolean).join(', ')}</div>
                    )}
                  </div>
                  <div className="cust-bill-price">{fmt(item.price * item.qty)}</div>
                </div>
              ))}
            </div>

            <div className="cust-bill-totals">
              <div className="cust-bill-total-row"><span>Subtotal</span><span>{fmt(openOrder.subtotal)}</span></div>
              <div className="cust-bill-total-row"><span>Pajak (10%)</span><span>{fmt(openOrder.tax)}</span></div>
              <div className="cust-bill-total-row cust-bill-grand"><span>Total</span><span>{fmt(openOrder.total)}</span></div>
            </div>

            {billRequested ? (
              <div className="cust-requested-badge">
                🔔 Kasir sedang dihubungi — silakan ke kasir untuk pembayaran
              </div>
            ) : (
              <button className="cust-btn-primary" onClick={handleRequestBill}>
                🧾 Minta Struk / Bayar di Kasir
              </button>
            )}
          </>
        )}
        <button className="cust-btn-ghost" onClick={() => setPhase('menu')}>Kembali ke Menu</button>
      </div>
    </div>
  )

  // ── Phase: CART ──────────────────────────────────────────────────────────────

  if (phase === 'cart') return (
    <div className="cust-root">
      <div className="cust-header">
        <button className="cust-back-btn" onClick={() => setPhase('menu')}>←</button>
        <div className="cust-header-info">
          <div className="cust-header-title">Pesanan Anda</div>
          <div className="cust-header-sub">Meja {tableId}</div>
        </div>
        <div />
      </div>

      <div className="cust-cart-body">
        {cart.length === 0 ? (
          <div className="cust-empty">Keranjang kosong</div>
        ) : (
          cart.map(item => (
            <div key={item._id} className="cust-cart-row">
              <div className="cust-cart-info">
                <div className="cust-cart-name">{item.name}</div>
                {item.modifiers && Object.values(item.modifiers).filter(Boolean).length > 0 && (
                  <div className="cust-cart-mods">{Object.values(item.modifiers).filter(Boolean).join(', ')}</div>
                )}
                {item.note && <div className="cust-cart-note">📝 {item.note}</div>}
                <div className="cust-cart-price">{fmt(item.price)}</div>
              </div>
              <div className="cust-qty-ctrl">
                <button className="cust-qty-btn" onClick={() => updateQty(item._id, -1)}>−</button>
                <span className="cust-qty-val">{item.qty}</span>
                <button className="cust-qty-btn" onClick={() => updateQty(item._id, 1)}>+</button>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="cust-cart-summary">
          <div className="cust-cart-total-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="cust-cart-total-row"><span>Pajak (10%)</span><span>{fmt(tax)}</span></div>
          <div className="cust-cart-total-row cust-cart-grand"><span>Total</span><span>{fmt(total)}</span></div>
        </div>
      )}

      <div className="cust-cart-footer">
        {openOrder && (
          <button className="cust-btn-ghost" onClick={() => setPhase('bill')}>
            Lihat Tagihan Saat Ini
          </button>
        )}
        <button
          className="cust-btn-primary"
          onClick={handlePlaceOrder}
          disabled={cart.length === 0 || ordering}
        >
          {ordering ? 'Mengirim...' : `Kirim Pesanan · ${fmt(total)}`}
        </button>
      </div>
    </div>
  )

  // ── Phase: MENU (default) ────────────────────────────────────────────────────

  return (
    <div className="cust-root">
      {modOverlay}

      <div className="cust-header">
        <div className="cust-header-logo">🍽️</div>
        <div className="cust-header-info">
          <div className="cust-header-title">PawonLoka</div>
          <div className="cust-header-sub">Meja {tableId}</div>
        </div>
        {openOrder ? (
          <button className="cust-bill-icon-btn" onClick={() => setPhase('bill')}>
            🧾{billRequested && <span className="cust-bill-check">✓</span>}
          </button>
        ) : <div />}
      </div>

      <div className="cust-cats-wrap">
        {categories.map(cat => (
          <button
            key={cat.name}
            className={'cust-cat-btn' + (activeCat === cat.name ? ' active' : '')}
            onClick={() => setActiveCat(cat.name)}
          >
            {cat.icon && <span>{cat.icon} </span>}{cat.name}
          </button>
        ))}
      </div>

      <div className="cust-products">
        {visibleProducts.map(product => (
          <button key={product.sku} className="cust-product-card" onClick={() => handleTapProduct(product)}>
            <div className="cust-product-img">
              {product.image_url
                ? <img src={product.image_url} alt={product.name} />
                : <span className="cust-product-emoji">{product.icon || '🍽️'}</span>
              }
            </div>
            <div className="cust-product-body">
              <div className="cust-product-name">{product.name}</div>
              {product.desc && <div className="cust-product-desc">{product.desc}</div>}
              <div className="cust-product-price">{fmt(product.price)}</div>
            </div>
            <div className="cust-product-add">+</div>
          </button>
        ))}
        {visibleProducts.length === 0 && (
          <div className="cust-empty" style={{ gridColumn: '1 / -1' }}>Tidak ada menu</div>
        )}
      </div>

      {cartCount > 0 && (
        <button className="cust-fab" onClick={() => setPhase('cart')}>
          🛒
          <span className="cust-fab-badge">{cartCount}</span>
          <span className="cust-fab-label">Lihat Pesanan · {fmt(total)}</span>
        </button>
      )}
    </div>
  )
}
