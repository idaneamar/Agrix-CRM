import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  supabase, FREQ_LABELS, STATUS_LABELS, KIND_LABELS, ORDER_STATUS_LABELS,
  fmtMoney, fmtDate, fmtDateTime,
} from '../supabase.js'
import Modal from '../components/Modal.jsx'
import { CustomerForm } from './Customers.jsx'
import OrderForm from '../components/OrderForm.jsx'
import { waLink, wazeLink } from '../logic.js'
import { QuoteForm, printQuote, QUOTE_STATUS } from './PriceBook.jsx'
import { useRates } from '../rates.js'

export default function CustomerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [tab, setTab] = useState('info')
  const [editing, setEditing] = useState(false)

  async function load() {
    const { data } = await supabase.from('customers').select('*').eq('id', id).single()
    setCustomer(data)
  }
  useEffect(() => { load() }, [id])

  if (!customer) return <div className="empty">טוען…</div>

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>{customer.name}</h1>
          <div className="muted small-text">
            {STATUS_LABELS[customer.status]} · אספקה {FREQ_LABELS[customer.delivery_frequency]}
          </div>
        </div>
        <button className="ghost small" onClick={() => setEditing(true)}>עריכה</button>
      </div>

      <div className="tabs">
        {[['info', 'פרטים'], ['prices', 'מוצרים ומחירים'], ['calls', 'שיחות'], ['orders', 'משלוחים'], ['quotes', 'הצעות מחיר'], ['files', 'מסמכים']].map(([k, v]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      {tab === 'info' && <InfoTab c={customer} onDeleted={() => nav('/customers')} />}
      {tab === 'prices' && <PricesTab customerId={id} />}
      {tab === 'calls' && <CallsTab customerId={id} />}
      {tab === 'orders' && <OrdersTab customerId={id} />}
      {tab === 'quotes' && <CustomerQuotesTab customer={customer} />}
      {tab === 'files' && <FilesTab customerId={id} />}

      {editing && (
        <Modal title="עריכת לקוח" onClose={() => setEditing(false)}>
          <CustomerForm initial={customer} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />
        </Modal>
      )}
    </div>
  )
}

function InfoTab({ c, onDeleted }) {
  const [confirm, setConfirm] = useState(false)
  async function del() {
    await supabase.from('customers').delete().eq('id', c.id)
    onDeleted()
  }
  const rows = [
    ['איש קשר', c.contact_name],
    ['טלפון', c.phone && <a href={`tel:${c.phone}`} dir="ltr">{c.phone}</a>],
    ['אימייל', c.email],
    ['כתובת', [c.street, c.city].filter(Boolean).join(', ')],
    ['הערות לכתובת', c.address_notes],
    ['תנאי תשלום', c.payment_terms],
    ['הערות', c.notes],
  ]
  const wa = waLink(c.phone)
  const waze = wazeLink(c)
  return (
    <div className="card">
      <div className="actions" style={{ marginTop: 0, marginBottom: 12, flexWrap: 'wrap' }}>
        {c.phone && <a className="btn small" href={`tel:${c.phone}`}>📞 חיוג</a>}
        {wa && <a className="btn small" style={{ background: '#25d366' }} href={wa} target="_blank" rel="noreferrer">💬 וואטסאפ</a>}
        {waze && <a className="btn small" style={{ background: '#33ccff' }} href={waze} target="_blank" rel="noreferrer">🗺 Waze</a>}
      </div>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><th style={{ width: 120 }}>{k}</th><td>{v || '—'}</td></tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16 }}>
        {!confirm ? (
          <button className="ghost small" onClick={() => setConfirm(true)}>מחיקת לקוח</button>
        ) : (
          <div className="actions">
            <span className="small-text">למחוק את הלקוח וכל ההיסטוריה שלו?</span>
            <button className="danger small" onClick={del}>כן, מחק</button>
            <button className="ghost small" onClick={() => setConfirm(false)}>ביטול</button>
          </div>
        )}
      </div>
    </div>
  )
}

function PricesTab({ customerId }) {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [editRow, setEditRow] = useState(null)

  async function load() {
    const [r, p] = await Promise.all([
      supabase.from('customer_products').select('*, products(name, unit)').eq('customer_id', customerId),
      supabase.from('products').select('*').eq('active', true).order('name'),
    ])
    setRows(r.data || [])
    setProducts(p.data || [])
  }
  useEffect(() => { load() }, [customerId])

  return (
    <div className="card">
      <div className="section-head">
        <h2>מחירים וכמויות שסגרנו</h2>
        <button className="small" onClick={() => setEditRow({})}>+ הוספה</button>
      </div>
      {rows.length === 0 && <div className="empty">עוד לא הוגדרו מוצרים ללקוח</div>}
      {rows.length > 0 && (
        <table>
          <thead><tr><th>מוצר</th><th>מחיר שסגרנו</th><th>כמות</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.products?.name}</td>
                <td className="num">{fmtMoney(r.agreed_price)} / {r.products?.unit}</td>
                <td className="num">
                  {r.quantity ? `${r.quantity} ${r.products?.unit} ${r.quantity_period === 'weekly' ? 'בשבוע' : 'בחודש'}` : '—'}
                </td>
                <td><button className="ghost small" onClick={() => setEditRow(r)}>עריכה</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editRow && (
        <PriceForm
          customerId={customerId}
          products={products}
          initial={editRow.id ? editRow : null}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); load() }}
        />
      )}
    </div>
  )
}

function PriceForm({ customerId, products, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { product_id: products[0]?.id || '', agreed_price: '', quantity: '', quantity_period: 'weekly', notes: '' })
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault(); setErr('')
    const row = {
      customer_id: customerId,
      product_id: f.product_id,
      agreed_price: f.agreed_price === '' ? null : Number(f.agreed_price),
      quantity: f.quantity === '' ? null : Number(f.quantity),
      quantity_period: f.quantity_period,
      notes: f.notes || null,
    }
    const res = initial
      ? await supabase.from('customer_products').update(row).eq('id', initial.id)
      : await supabase.from('customer_products').insert(row)
    if (res.error) return setErr(res.error.code === '23505' ? 'כבר קיימת שורה למוצר הזה — ערוך אותה במקום' : res.error.message)
    onSaved()
  }
  async function del() {
    await supabase.from('customer_products').delete().eq('id', initial.id)
    onSaved()
  }

  return (
    <Modal title={initial ? 'עריכת מוצר ללקוח' : 'הוספת מוצר ללקוח'} onClose={onClose}>
      <form onSubmit={save}>
        <label>מוצר</label>
        <select value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })} disabled={!!initial}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="formrow">
          <div><label>מחיר שסגרנו (₪ ליחידה)</label><input type="number" step="0.01" min="0" value={f.agreed_price ?? ''} onChange={(e) => setF({ ...f, agreed_price: e.target.value })} /></div>
          <div><label>כמות</label><input type="number" step="0.01" min="0" value={f.quantity ?? ''} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
        </div>
        <label>תקופת הכמות</label>
        <select value={f.quantity_period} onChange={(e) => setF({ ...f, quantity_period: e.target.value })}>
          <option value="weekly">בשבוע</option>
          <option value="monthly">בחודש</option>
        </select>
        <label>הערות</label>
        <input value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
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

function CallsTab({ customerId }) {
  const [calls, setCalls] = useState([])
  const [adding, setAdding] = useState(false)

  async function load() {
    const { data } = await supabase.from('calls').select('*').eq('customer_id', customerId).order('call_date', { ascending: false })
    setCalls(data || [])
  }
  useEffect(() => { load() }, [customerId])

  return (
    <div className="card">
      <div className="section-head">
        <h2>היסטוריית שיחות</h2>
        <button className="small" onClick={() => setAdding(true)}>+ שיחה</button>
      </div>
      {calls.length === 0 && <div className="empty">אין שיחות מתועדות</div>}
      {calls.map((c) => (
        <div key={c.id} className="list-item">
          <div className="grow">
            <div className="sub">{fmtDateTime(c.call_date)}</div>
            <div>{c.summary}</div>
            {c.outcome && <div className="small-text" style={{ marginTop: 4 }}><b>מה סגרנו:</b> {c.outcome}</div>}
            {c.next_action && (
              <div className="small-text muted" style={{ marginTop: 2 }}>
                המשך טיפול: {c.next_action}{c.next_action_date ? ` (עד ${fmtDate(c.next_action_date)})` : ''}
              </div>
            )}
          </div>
        </div>
      ))}
      {adding && <CallForm customerId={customerId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </div>
  )
}

function CallForm({ customerId, onClose, onSaved }) {
  const [f, setF] = useState({
    call_date: new Date().toISOString().slice(0, 16),
    summary: '', outcome: '', next_action: '', next_action_date: '',
  })
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault(); setErr('')
    const res = await supabase.from('calls').insert({
      customer_id: customerId,
      call_date: new Date(f.call_date).toISOString(),
      summary: f.summary,
      outcome: f.outcome || null,
      next_action: f.next_action || null,
      next_action_date: f.next_action_date || null,
    })
    if (res.error) return setErr(res.error.message)
    onSaved()
  }

  return (
    <Modal title="תיעוד שיחה" onClose={onClose}>
      <form onSubmit={save}>
        <label>מועד השיחה</label>
        <input type="datetime-local" value={f.call_date} onChange={(e) => setF({ ...f, call_date: e.target.value })} required />
        <label>סיכום השיחה *</label>
        <textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} required />
        <label>מה סגרנו בשיחה</label>
        <textarea value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} />
        <div className="formrow">
          <div><label>המשך טיפול</label><input value={f.next_action} onChange={(e) => setF({ ...f, next_action: e.target.value })} /></div>
          <div><label>עד תאריך</label><input type="date" value={f.next_action_date} onChange={(e) => setF({ ...f, next_action_date: e.target.value })} /></div>
        </div>
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button>שמירה</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}

function OrdersTab({ customerId }) {
  const [orders, setOrders] = useState([])
  const [adding, setAdding] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, description, products(name, unit))')
      .eq('customer_id', customerId)
      .order('delivery_date', { ascending: false, nullsFirst: false })
    setOrders(data || [])
  }
  useEffect(() => { load() }, [customerId])

  async function setStatus(o, status) {
    await supabase.from('orders').update({ status }).eq('id', o.id)
    load()
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>משלוחים והזמנות</h2>
        <button className="small" onClick={() => setAdding(true)}>+ משלוח</button>
      </div>
      {orders.length === 0 && <div className="empty">אין משלוחים</div>}
      {orders.map((o) => {
        const total = (o.order_items || []).reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0)
        return (
          <div key={o.id} className="list-item">
            <div className="grow">
              <div className="title">{fmtDate(o.delivery_date)} · <span className="num">{fmtMoney(total)}</span></div>
              <div className="sub">
                {(o.order_items || []).map((it) => `${it.products?.name || it.description || '?'} ×${it.quantity}${it.products?.unit ? ` ${it.products.unit}` : ''}`).join(' · ') || 'ללא פריטים'}
              </div>
              {o.notes && <div className="small-text muted">{o.notes}</div>}
            </div>
            <span className={`badge ${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span>
            {o.status === 'planned' && (
              <button className="ghost small" onClick={() => setStatus(o, 'delivered')}>סופק ✓</button>
            )}
          </div>
        )
      })}
      {adding && (
        <OrderForm customerId={customerId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}
    </div>
  )
}

function CustomerQuotesTab({ customer }) {
  const [quotes, setQuotes] = useState([])
  const [aux, setAux] = useState(null)
  const [editing, setEditing] = useState(null)
  const { rates } = useRates()

  async function load() {
    const [qs, p, pb, cp] = await Promise.all([
      supabase.from('quotes').select('*, quote_items(*)').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('active', true),
      supabase.from('supplier_quotes').select('*'),
      supabase.from('customer_products').select('*').eq('customer_id', customer.id),
    ])
    setQuotes(qs.data || [])
    setAux({ products: p.data || [], priceBook: pb.data || [], cps: cp.data || [] })
  }
  useEffect(() => { load() }, [customer.id])

  async function setStatus(quote, status) {
    await supabase.from('quotes').update({ status }).eq('id', quote.id)
    load()
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>הצעות מחיר ללקוח</h2>
        <button className="small" onClick={() => setEditing({})} disabled={!aux}>+ הצעת מחיר</button>
      </div>
      {quotes.length === 0 && <div className="empty">אין הצעות מחיר ללקוח זה</div>}
      {quotes.map((quote) => {
        const subtotal = (quote.quote_items || []).reduce((t, it) => t + Number(it.quantity) * Number(it.unit_price), 0)
        const total = subtotal * (1 + Number(quote.vat_pct) / 100)
        return (
          <div key={quote.id} className="list-item">
            <div className="grow">
              <div className="title">#{quote.quote_number} · {fmtDate(quote.created_at)}</div>
              <div className="sub num">
                {(quote.quote_items || []).length} פריטים · סה״כ כולל מע״מ: <b>{fmtMoney(total)}</b>
              </div>
            </div>
            <span className={`badge ${quote.status === 'accepted' ? 'delivered' : quote.status === 'rejected' ? 'canceled' : 'planned'}`}>
              {QUOTE_STATUS[quote.status]}
            </span>
            <button className="ghost small" onClick={() => printQuote(quote)}>🖨</button>
            <button className="ghost small" onClick={() => setEditing(quote)}>עריכה</button>
            {quote.status === 'draft' && <button className="ghost small" onClick={() => setStatus(quote, 'sent')}>נשלחה ✓</button>}
          </div>
        )
      })}
      {editing && aux && (
        <QuoteForm
          initial={editing.id ? editing : null}
          customers={[{ id: customer.id, name: customer.name }]}
          defaultCustomerId={customer.id}
          priceBook={aux.priceBook}
          products={aux.products}
          cps={aux.cps}
          rates={rates}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function FilesTab({ customerId }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState('invoice')
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.from('attachments').select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
    setFiles(data || [])
  }
  useEffect(() => { load() }, [customerId])

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    const path = `${customerId}/${Date.now()}-${file.name}`
    const up = await supabase.storage.from('attachments').upload(path, file)
    if (up.error) { setErr(up.error.message); setBusy(false); return }
    const ins = await supabase.from('attachments').insert({
      customer_id: customerId, kind, title: file.name, file_path: path,
      file_size: file.size, mime_type: file.type,
    })
    if (ins.error) setErr(ins.error.message)
    setBusy(false)
    e.target.value = ''
    load()
  }

  async function open(f) {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(f.file_path, 3600)
    if (!error) window.open(data.signedUrl, '_blank')
  }

  async function del(f) {
    await supabase.storage.from('attachments').remove([f.file_path])
    await supabase.from('attachments').delete().eq('id', f.id)
    load()
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>חשבוניות וחוזים</h2>
      </div>
      <div className="formrow" style={{ alignItems: 'end', gap: 12, display: 'flex', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>סוג מסמך</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="btn" style={{ marginBottom: 0 }}>
            {busy ? 'מעלה…' : '📎 העלאת קובץ'}
            <input type="file" style={{ display: 'none' }} onChange={upload} disabled={busy} />
          </label>
        </div>
      </div>
      {err && <div className="error">{err}</div>}
      <div style={{ marginTop: 12 }}>
        {files.length === 0 && <div className="empty">אין מסמכים</div>}
        {files.map((f) => (
          <div key={f.id} className="list-item">
            <div className="grow">
              <div className="title">{f.title}</div>
              <div className="sub">{KIND_LABELS[f.kind]} · {fmtDate(f.created_at)}</div>
            </div>
            <button className="ghost small" onClick={() => open(f)}>פתיחה</button>
            <button className="ghost small" onClick={() => del(f)}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}
