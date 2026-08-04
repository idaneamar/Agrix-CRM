import React, { useEffect, useMemo, useState } from 'react'
import { supabase, fmtMoney, fmtDate } from '../supabase.js'
import { downloadCsv } from '../logic.js'
import { LOGO } from '../logo.js'
import { CURRENCIES, useRates, toILS, fromILS, fmtCur } from '../rates.js'
import Modal from '../components/Modal.jsx'

const INCOTERMS = { EXW: 'EXW (מחצר הספק)', FOB: 'FOB (עד הנמל בחו"ל)', CIF: 'CIF (כולל הובלה וביטוח)', DDP: 'DDP (עד הדלת)', other: 'אחר' }
const QUOTE_STATUS = { draft: 'טיוטה', sent: 'נשלחה', accepted: 'התקבלה', rejected: 'נדחתה' }

// Total cost per unit in ILS, using live rates (falls back to the saved snapshot rate).
export const costPerUnitILS = (q, rates) =>
  toILS(q.unit_cost, q.currency, rates, q.fx_rate) +
  toILS(q.freight_unit_cost, q.freight_currency || 'ILS', rates) +
  toILS(q.extra_unit_cost, q.extra_currency || 'ILS', rates)

export const salePriceILS = (q, rates) => costPerUnitILS(q, rates) * (1 + Number(q.margin_pct) / 100)

// Which currency to display totals in: the single currency used, or ILS when mixed.
export function displayCurrency(q) {
  const used = new Set([q.currency || 'ILS'])
  if (Number(q.freight_unit_cost) > 0) used.add(q.freight_currency || 'ILS')
  if (Number(q.extra_unit_cost) > 0) used.add(q.extra_currency || 'ILS')
  return used.size === 1 ? [...used][0] : 'ILS'
}

// Amount input with a currency selector beside it.
function MoneyRow({ label, value, onValue, currency, onCurrency, required }) {
  return (
    <div>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={{ flex: 2 }} type="number" step="0.0001" min="0" value={value ?? ''} onChange={onValue} required={required} />
        <select style={{ flex: 1, maxWidth: 110 }} value={currency || 'ILS'} onChange={onCurrency}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}

export default function PriceBook() {
  const [tab, setTab] = useState('calc')
  return (
    <div>
      <h1>מחירון</h1>
      <div className="tabs">
        {[['calc', 'מחשבון מחירים'], ['quotes', 'הצעות מחיר']].map(([k, v]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>
      {tab === 'calc' && <CalculatorTab />}
      {tab === 'quotes' && <QuotesTab />}
    </div>
  )
}

/* ================= Supplier price calculator ================= */

function CalculatorTab() {
  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const { rates, updatedAt, refresh } = useRates()

  async function load() {
    const [r, s] = await Promise.all([
      supabase.from('supplier_quotes').select('*').order('product_name'),
      supabase.from('suppliers').select('id, name, country').order('name'),
    ])
    setRows(r.data || [])
    setSuppliers(s.data || [])
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter((r) =>
    [r.product_name, r.supplier_name, r.country].join(' ').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="card">
      <div className="section-head">
        <h2>מחירי ספקים ← מחיר מכירה</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost small" onClick={() =>
            downloadCsv('מחירון.csv',
              ['מוצר', 'ספק', 'מדינה', 'תנאי', 'מחיר ספק', 'מטבע', 'הובלה ליח׳', 'מטבע הובלה', 'נוספות ליח׳', 'מטבע נוספות', 'עלות ₪', '% רווח', 'מחיר מכירה ₪'],
              filtered.map((r) => [r.product_name, r.supplier_name || '', r.country || '', r.incoterm, r.unit_cost, r.currency, r.freight_unit_cost, r.freight_currency || 'ILS', r.extra_unit_cost, r.extra_currency || 'ILS', costPerUnitILS(r, rates).toFixed(2), r.margin_pct, salePriceILS(r, rates).toFixed(2)]))
          }>⬇ אקסל</button>
          <button className="small" onClick={() => setEditing({})}>+ מחיר ספק</button>
        </div>
      </div>
      <div className="small-text muted" style={{ marginBottom: 8 }}>
        {rates
          ? <>שערי המרה חיים · עודכן {updatedAt ? new Date(updatedAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : ''}{' '}
              <button className="ghost small" type="button" onClick={() => refresh()}>↺ רענון שערים</button></>
          : <>⚠ שערי מטבע לא זמינים כרגע (אין אינטרנט?) — מוצגים שערים אחרונים שנשמרו</>}
      </div>
      <input placeholder="חיפוש מהיר: מוצר, ספק, מדינה…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {filtered.length === 0 && <div className="empty">אין מחירים עדיין — הוסף מחיר ראשון מספק</div>}
      {filtered.map((r) => {
        const disp = displayCurrency(r)
        const costI = costPerUnitILS(r, rates)
        const saleI = salePriceILS(r, rates)
        return (
          <div key={r.id} className="list-item">
            <div className="grow">
              <div className="title">{r.product_name}</div>
              <div className="sub">
                {[r.supplier_name, r.country, INCOTERMS[r.incoterm]?.split(' ')[0]].filter(Boolean).join(' · ')}
                {' · '}מחיר ספק {fmtCur(Number(r.unit_cost), r.currency)}
                {Number(r.freight_unit_cost) > 0 && ` + הובלה ${fmtCur(Number(r.freight_unit_cost), r.freight_currency || 'ILS')}`}
                {Number(r.extra_unit_cost) > 0 && ` + נוספות ${fmtCur(Number(r.extra_unit_cost), r.extra_currency || 'ILS')}`}
                {' · '}{fmtDate(r.quote_date)}
              </div>
              <div className="sub num">
                עלות: <b>{fmtCur(fromILS(costI, disp, rates), disp)}</b> / {r.unit} · רווח {Number(r.margin_pct)}% ←{' '}
                <b style={{ color: 'var(--good-text)', fontSize: '1.05em' }}>מכירה: {fmtCur(fromILS(saleI, disp, rates), disp)} / {r.unit}</b>
                {disp !== 'ILS' && <span className="muted"> ({fmtMoney(saleI)})</span>}
              </div>
            </div>
            <button className="ghost small" onClick={() => setEditing(r)}>עריכה</button>
          </div>
        )
      })}
      {editing && (
        <QuoteCalcForm
          initial={editing.id ? editing : null}
          suppliers={suppliers}
          rates={rates}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function QuoteCalcForm({ initial, suppliers, rates, onClose, onSaved }) {
  const [f, setF] = useState(initial || {
    product_name: '', supplier_id: '', supplier_name: '', country: '', incoterm: 'FOB',
    unit: 'kg', unit_cost: '', currency: 'USD', freight_unit_cost: 0, freight_currency: 'ILS',
    extra_unit_cost: 0, extra_currency: 'ILS', margin_pct: 30,
    quote_date: new Date().toISOString().slice(0, 10), notes: '',
  })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function pickSupplier(e) {
    const id = e.target.value
    const s = suppliers.find((x) => x.id === id)
    setF({ ...f, supplier_id: id, supplier_name: s?.name || f.supplier_name, country: f.country || s?.country || '' })
  }

  const preview = {
    unit_cost: Number(f.unit_cost) || 0, currency: f.currency, fx_rate: f.fx_rate,
    freight_unit_cost: Number(f.freight_unit_cost) || 0, freight_currency: f.freight_currency,
    extra_unit_cost: Number(f.extra_unit_cost) || 0, extra_currency: f.extra_currency,
    margin_pct: Number(f.margin_pct) || 0,
  }
  const disp = displayCurrency(preview)
  const costI = costPerUnitILS(preview, rates)
  const saleI = salePriceILS(preview, rates)

  async function save(e) {
    e.preventDefault(); setErr('')
    // Snapshot the current unit-currency rate for offline fallback / history.
    const snap = f.currency === 'ILS' ? 1 : (rates?.[f.currency] ? 1 / rates[f.currency] : Number(initial?.fx_rate) || 1)
    const row = {
      product_name: f.product_name,
      supplier_id: f.supplier_id || null,
      supplier_name: f.supplier_name || null,
      country: f.country || null,
      incoterm: f.incoterm,
      unit: f.unit,
      unit_cost: Number(f.unit_cost),
      currency: f.currency,
      fx_rate: Math.round(snap * 10000) / 10000,
      freight_unit_cost: Number(f.freight_unit_cost) || 0,
      freight_currency: f.freight_currency || 'ILS',
      extra_unit_cost: Number(f.extra_unit_cost) || 0,
      extra_currency: f.extra_currency || 'ILS',
      margin_pct: Number(f.margin_pct) || 0,
      quote_date: f.quote_date,
      notes: f.notes || null,
    }
    const res = initial
      ? await supabase.from('supplier_quotes').update(row).eq('id', initial.id)
      : await supabase.from('supplier_quotes').insert(row)
    if (res.error) return setErr(res.error.message)
    onSaved()
  }

  async function del() {
    await supabase.from('supplier_quotes').delete().eq('id', initial.id)
    onSaved()
  }

  return (
    <Modal title={initial ? 'עריכת מחיר ספק' : 'מחיר ספק חדש'} onClose={onClose}>
      <form onSubmit={save}>
        <label>שם המוצר *</label>
        <input value={f.product_name} onChange={set('product_name')} required placeholder="למשל: קשיו W320" />
        <div className="formrow">
          <div>
            <label>ספק קיים</label>
            <select value={f.supplier_id || ''} onChange={pickSupplier}>
              <option value="">— בחר או הקלד ידנית —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label>שם ספק (ידני)</label><input value={f.supplier_name || ''} onChange={set('supplier_name')} /></div>
        </div>
        <div className="formrow">
          <div><label>מדינה</label><input value={f.country || ''} onChange={set('country')} placeholder="וייטנאם, טורקיה…" /></div>
          <div>
            <label>תנאי מכר (Incoterm)</label>
            <select value={f.incoterm} onChange={set('incoterm')}>
              {Object.entries(INCOTERMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="formrow">
          <div>
            <label>יחידה</label>
            <select value={f.unit} onChange={set('unit')}>
              <option value="kg">ק״ג</option><option value="unit">יחידה</option><option value="carton">קרטון</option>
            </select>
          </div>
          <div />
        </div>
        <MoneyRow label="מחיר הספק (ליחידה) *" required value={f.unit_cost} onValue={set('unit_cost')} currency={f.currency} onCurrency={set('currency')} />
        <MoneyRow label="הובלה ליחידה — רלוונטי ל-FOB/EXW" value={f.freight_unit_cost} onValue={set('freight_unit_cost')} currency={f.freight_currency} onCurrency={set('freight_currency')} />
        <MoneyRow label="עלויות נוספות ליחידה" value={f.extra_unit_cost} onValue={set('extra_unit_cost')} currency={f.extra_currency} onCurrency={set('extra_currency')} />
        <label>אחוז רווח רצוי (%)</label>
        <input type="number" step="0.1" min="0" value={f.margin_pct} onChange={set('margin_pct')} />
        <label>הערות</label>
        <input value={f.notes || ''} onChange={set('notes')} />

        <div className="card" style={{ marginTop: 14, background: 'var(--page)' }}>
          <div className="num">עלות כוללת ליחידה: <b>{fmtCur(fromILS(costI, disp, rates), disp)}</b>{disp !== 'ILS' && <span className="muted"> ({fmtMoney(costI)})</span>}</div>
          <div className="num" style={{ fontSize: '1.15rem', color: 'var(--good-text)' }}>
            מחיר מכירה מומלץ: <b>{fmtCur(fromILS(saleI, disp, rates), disp)}</b>{disp !== 'ILS' && <span className="muted"> ({fmtMoney(saleI)})</span>}
          </div>
          <div className="small-text muted">מחושב לפי שער עדכני — המחיר יתעדכן אוטומטית עם השער</div>
        </div>

        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button>שמירה</button>
          {initial && <button type="button" className="danger" onClick={del}>מחיקה</button>}
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}

/* ================= Customer quotes (price offers) ================= */

function QuotesTab() {
  const [quotes, setQuotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [priceBook, setPriceBook] = useState([])
  const [products, setProducts] = useState([])
  const [cps, setCps] = useState([])
  const [editing, setEditing] = useState(null)
  const { rates } = useRates()

  async function load() {
    const [qs, c, pb, p, cp] = await Promise.all([
      supabase.from('quotes').select('*, quote_items(*)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name, contact_name, phone, email, city, street').order('name'),
      supabase.from('supplier_quotes').select('*'),
      supabase.from('products').select('*').eq('active', true),
      supabase.from('customer_products').select('*'),
    ])
    setQuotes(qs.data || [])
    setCustomers(c.data || [])
    setPriceBook(pb.data || [])
    setProducts(p.data || [])
    setCps(cp.data || [])
  }
  useEffect(() => { load() }, [])

  async function setStatus(quote, status) {
    await supabase.from('quotes').update({ status }).eq('id', quote.id)
    load()
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>הצעות מחיר</h2>
        <button className="small" onClick={() => setEditing({})}>+ הצעת מחיר</button>
      </div>
      {quotes.length === 0 && <div className="empty">אין הצעות מחיר — צור את הראשונה</div>}
      {quotes.map((quote) => {
        const subtotal = (quote.quote_items || []).reduce((t, it) => t + Number(it.quantity) * Number(it.unit_price), 0)
        const total = subtotal * (1 + Number(quote.vat_pct) / 100)
        return (
          <div key={quote.id} className="list-item">
            <div className="grow">
              <div className="title">#{quote.quote_number} · {quote.customer_name}</div>
              <div className="sub">
                {fmtDate(quote.created_at)} · {(quote.quote_items || []).length} פריטים ·{' '}
                <span className="num">סה״כ כולל מע״מ: <b>{fmtMoney(total)}</b></span>
              </div>
            </div>
            <span className={`badge ${quote.status === 'accepted' ? 'delivered' : quote.status === 'rejected' ? 'canceled' : 'planned'}`}>
              {QUOTE_STATUS[quote.status]}
            </span>
            <button className="ghost small" onClick={() => printQuote(quote)}>🖨 הדפסה</button>
            <button className="ghost small" onClick={() => setEditing(quote)}>עריכה</button>
            {quote.status === 'draft' && <button className="ghost small" onClick={() => setStatus(quote, 'sent')}>נשלחה ✓</button>}
            {quote.status === 'sent' && <button className="ghost small" onClick={() => setStatus(quote, 'accepted')}>התקבלה ✓</button>}
          </div>
        )
      })}
      {editing && (
        <QuoteForm
          initial={editing.id ? editing : null}
          customers={customers}
          priceBook={priceBook}
          products={products}
          cps={cps}
          rates={rates}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function QuoteForm({ initial, customers, priceBook, products, cps, rates, onClose, onSaved }) {
  const [customerId, setCustomerId] = useState(initial?.customer_id || '')
  const [customerName, setCustomerName] = useState(initial?.customer_name || '')
  const [validUntil, setValidUntil] = useState(initial?.valid_until || defaultValidity())
  const [vatPct, setVatPct] = useState(initial?.vat_pct ?? 18)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [items, setItems] = useState(
    initial ? (initial.quote_items || []).sort((a, b) => a.position - b.position).map((it) => ({
      description: it.description, unit: it.unit, quantity: it.quantity, unit_price: it.unit_price,
    })) : []
  )
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function defaultValidity() {
    const d = new Date(); d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  }

  // Suggestions: products (with customer agreed price if exists) + price book entries (sale price)
  const suggestions = useMemo(() => {
    const list = []
    products.forEach((p) => {
      const agreed = customerId ? cps.find((x) => x.customer_id === customerId && x.product_id === p.id) : null
      list.push({ label: p.name, unit: p.unit, price: agreed?.agreed_price ?? p.default_price ?? '' })
    })
    priceBook.forEach((r) => {
      list.push({ label: `${r.product_name}${r.country ? ` (${r.country})` : ''}`, unit: r.unit, price: Math.round(salePriceILS(r, rates) * 100) / 100 })
    })
    return list
  }, [products, priceBook, cps, customerId, rates])

  function pickCustomer(e) {
    const id = e.target.value
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    if (c) setCustomerName(c.name)
  }

  function addItem(sug) {
    if (sug) setItems([...items, { description: sug.label, unit: sug.unit || 'kg', quantity: 1, unit_price: sug.price }])
    else setItems([...items, { description: '', unit: 'kg', quantity: 1, unit_price: '' }])
  }

  function upd(i, k, v) {
    const n = items.slice(); n[i] = { ...n[i], [k]: v }; setItems(n)
  }

  const subtotal = items.reduce((t, it) => t + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  const vat = subtotal * (Number(vatPct) / 100)

  async function save(e) {
    e.preventDefault(); setErr('')
    if (!customerName.trim()) return setErr('הזן שם לקוח')
    const valid = items.filter((it) => it.description.trim() && Number(it.quantity) > 0)
    if (!valid.length) return setErr('הוסף לפחות פריט אחד')
    setBusy(true)
    const row = {
      customer_id: customerId || null,
      customer_name: customerName.trim(),
      valid_until: validUntil || null,
      vat_pct: Number(vatPct) || 0,
      notes: notes || null,
    }
    let quoteId = initial?.id
    if (quoteId) {
      const res = await supabase.from('quotes').update(row).eq('id', quoteId)
      if (res.error) { setErr(res.error.message); setBusy(false); return }
      await supabase.from('quote_items').delete().eq('quote_id', quoteId)
    } else {
      const res = await supabase.from('quotes').insert(row).select().single()
      if (res.error) { setErr(res.error.message); setBusy(false); return }
      quoteId = res.data.id
    }
    const res2 = await supabase.from('quote_items').insert(valid.map((it, i) => ({
      quote_id: quoteId, position: i, description: it.description.trim(),
      unit: it.unit, quantity: Number(it.quantity), unit_price: Number(it.unit_price) || 0,
    })))
    if (res2.error) { setErr(res2.error.message); setBusy(false); return }
    setBusy(false)
    onSaved()
  }

  return (
    <Modal title={initial ? `עריכת הצעה #${initial.quote_number}` : 'הצעת מחיר חדשה'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="formrow">
          <div>
            <label>לקוח קיים</label>
            <select value={customerId} onChange={pickCustomer}>
              <option value="">— לקוח חדש / ידני —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label>שם הלקוח על ההצעה *</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required /></div>
        </div>
        <div className="formrow">
          <div><label>בתוקף עד</label><input type="date" value={validUntil || ''} onChange={(e) => setValidUntil(e.target.value)} /></div>
          <div><label>מע״מ (%)</label><input type="number" step="0.1" min="0" value={vatPct} onChange={(e) => setVatPct(e.target.value)} /></div>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <h3>פריטים</h3>
          <button type="button" className="ghost small" onClick={() => addItem()}>+ שורה ריקה</button>
        </div>
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {suggestions.slice(0, 8).map((s, i) => (
              <button key={i} type="button" className="ghost small" onClick={() => addItem(s)}>
                + {s.label}{s.price !== '' && s.price != null ? ` (${fmtMoney(s.price)})` : ''}
              </button>
            ))}
          </div>
        )}
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ flex: '3 1 150px' }} placeholder="תיאור המוצר" value={it.description} onChange={(e) => upd(i, 'description', e.target.value)} />
            <input style={{ flex: '1 1 60px' }} type="number" step="0.01" min="0" placeholder="כמות" value={it.quantity} onChange={(e) => upd(i, 'quantity', e.target.value)} />
            <select style={{ flex: '1 1 60px' }} value={it.unit} onChange={(e) => upd(i, 'unit', e.target.value)}>
              <option value="kg">ק״ג</option><option value="unit">יח׳</option><option value="carton">קרטון</option>
            </select>
            <input style={{ flex: '1 1 80px' }} type="number" step="0.01" min="0" placeholder="מחיר ליח׳ ₪" value={it.unit_price} onChange={(e) => upd(i, 'unit_price', e.target.value)} />
            <button type="button" className="ghost small" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}

        {items.length > 0 && (
          <div className="card" style={{ background: 'var(--page)' }}>
            <div className="num">סכום ביניים: {fmtMoney(subtotal)}</div>
            <div className="num">מע״מ {vatPct}%: {fmtMoney(vat)}</div>
            <div className="num" style={{ fontSize: '1.1rem' }}><b>סה״כ לתשלום: {fmtMoney(subtotal + vat)}</b></div>
          </div>
        )}

        <label>הערות (תנאי תשלום, אספקה…)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}

/* ================= Branded printable quote ================= */

export function printQuote(quote) {
  const items = (quote.quote_items || []).slice().sort((a, b) => a.position - b.position)
  const subtotal = items.reduce((t, it) => t + Number(it.quantity) * Number(it.unit_price), 0)
  const vat = subtotal * (Number(quote.vat_pct) / 100)
  const nis = (n) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(n)
  const dateStr = new Date(quote.created_at).toLocaleDateString('he-IL')
  const validStr = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('he-IL') : null
  const unitLabel = { kg: 'ק״ג', unit: 'יח׳', carton: 'קרטון' }

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>הצעת מחיר ${quote.quote_number} — Agrix Trade</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d2b26; margin: 0; background: #f4f6f5; }
  .page { max-width: 800px; margin: 20px auto; background: #fff; padding: 48px 52px; min-height: 1000px; position: relative; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #6f9c8b; padding-bottom: 18px; }
  .top img { height: 72px; }
  .doc-title { text-align: left; }
  .doc-title h1 { margin: 0; font-size: 1.5rem; color: #4b7263; }
  .doc-title .num { font-size: 1.05rem; color: #666; }
  .meta { display: flex; justify-content: space-between; margin: 22px 0; gap: 20px; }
  .meta .block { font-size: 0.95rem; line-height: 1.6; }
  .meta .lbl { color: #6f9c8b; font-weight: 700; font-size: 0.8rem; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 0; }
  th { background: #6f9c8b; color: #fff; padding: 9px 10px; text-align: right; font-size: 0.85rem; }
  th:first-child { border-radius: 0 8px 8px 0; }
  th:last-child { border-radius: 8px 0 0 8px; }
  td { padding: 9px 10px; border-bottom: 1px solid #e3e9e6; font-size: 0.93rem; }
  tr:nth-child(even) td { background: #f7faf8; }
  .num { font-variant-numeric: tabular-nums; }
  .totals { margin-top: 14px; margin-inline-start: auto; width: 280px; font-size: 0.95rem; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 4px; }
  .totals .grand { border-top: 2px solid #6f9c8b; margin-top: 4px; padding-top: 9px; font-weight: 800; font-size: 1.1rem; color: #4b7263; }
  .notes { margin-top: 26px; background: #f7faf8; border-radius: 10px; padding: 14px 16px; font-size: 0.9rem; white-space: pre-wrap; }
  .notes .lbl { color: #6f9c8b; font-weight: 700; font-size: 0.8rem; margin-bottom: 4px; }
  footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e3e9e6; display: flex; justify-content: space-between; color: #888; font-size: 0.82rem; }
  .toolbar { max-width: 800px; margin: 14px auto 0; display: flex; gap: 10px; justify-content: center; }
  .toolbar button { font: inherit; background: #4b7263; color: #fff; border: 0; border-radius: 8px; padding: 10px 26px; cursor: pointer; font-size: 1rem; }
  @media print {
    body { background: #fff; }
    .page { margin: 0; padding: 24px 30px; min-height: auto; max-width: none; }
    .toolbar { display: none; }
  }
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">🖨 הדפסה / שמירה כ-PDF</button></div>
<div class="page">
  <div class="top">
    <img src="${LOGO}" alt="Agrix Trade" />
    <div class="doc-title">
      <h1>הצעת מחיר</h1>
      <div class="num">מס׳ ${quote.quote_number}</div>
    </div>
  </div>
  <div class="meta">
    <div class="block">
      <div class="lbl">לכבוד</div>
      <b>${esc(quote.customer_name)}</b>
      ${quote.customer_contact ? `<br/>${esc(quote.customer_contact)}` : ''}
    </div>
    <div class="block" style="text-align:left">
      <div class="lbl">פרטי ההצעה</div>
      תאריך: ${dateStr}
      ${validStr ? `<br/>בתוקף עד: ${validStr}` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th style="width:44%">מוצר</th><th>כמות</th><th>יחידה</th><th>מחיר ליחידה</th><th>סה״כ</th></tr></thead>
    <tbody>
      ${items.map((it) => `<tr>
        <td>${esc(it.description)}</td>
        <td class="num">${Number(it.quantity).toLocaleString('he-IL')}</td>
        <td>${unitLabel[it.unit] || esc(it.unit)}</td>
        <td class="num">${nis(Number(it.unit_price))}</td>
        <td class="num">${nis(Number(it.quantity) * Number(it.unit_price))}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="totals num">
    <div><span>סכום ביניים</span><span>${nis(subtotal)}</span></div>
    <div><span>מע״מ ${Number(quote.vat_pct)}%</span><span>${nis(vat)}</span></div>
    <div class="grand"><span>סה״כ לתשלום</span><span>${nis(subtotal + vat)}</span></div>
  </div>
  ${quote.notes ? `<div class="notes"><div class="lbl">הערות ותנאים</div>${esc(quote.notes)}</div>` : ''}
  <footer>
    <span>Agrix Trade · ייבוא פיצוחים ומזון</span>
    <span>הצעה מס׳ ${quote.quote_number} · ${dateStr}</span>
  </footer>
</div>
</body>
</html>`

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  window.open(url, '_blank')
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
