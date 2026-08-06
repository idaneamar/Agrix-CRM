import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, fmtMoney, fmtDate, IMPORT_KIND_LABELS } from '../supabase.js'
import { SHIPMENT_STATUS, landedCosts, stockByProduct, weeklyDemandByProduct, downloadCsv } from '../logic.js'
import Modal from '../components/Modal.jsx'

export default function ImportPage() {
  const [tab, setTab] = useState('stock')
  return (
    <div>
      <h1>ייבוא ומלאי</h1>
      <div className="tabs">
        {[['stock', 'מלאי'], ['shipments', 'משלוחי ייבוא']].map(([k, v]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>
      {tab === 'stock' && <StockTab />}
      {tab === 'shipments' && <ShipmentsTab />}
    </div>
  )
}

/* ---------- Stock ---------- */

function StockTab() {
  const [data, setData] = useState(null)
  const [adjusting, setAdjusting] = useState(null)

  async function load() {
    const [products, shipments, importItems, orderItems, adjustments, cps, customers] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('import_shipments').select('*'),
      supabase.from('import_items').select('*'),
      supabase.from('order_items').select('product_id, quantity, orders(status, customer_id)'),
      supabase.from('stock_adjustments').select('*'),
      supabase.from('customer_products').select('*'),
      supabase.from('customers').select('id, status'),
    ])
    setData({
      products: products.data || [],
      shipments: shipments.data || [],
      importItems: importItems.data || [],
      orderItems: orderItems.data || [],
      adjustments: adjustments.data || [],
      cps: cps.data || [],
      customers: customers.data || [],
    })
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    if (!data) return []
    const stock = stockByProduct(data.importItems, data.shipments, data.orderItems, data.adjustments)
    const demand = weeklyDemandByProduct(data.cps, data.customers)
    const landed = landedCosts(data.shipments, data.importItems)
    return data.products.filter((p) => p.active).map((p) => {
      const s = stock[p.id] || 0
      const d = demand[p.id] || 0
      const weeks = d > 0 ? s / d : null
      return { p, stock: s, weeklyDemand: d, weeks, landed: landed[p.id] ?? null }
    })
  }, [data])

  if (!data) return <div className="empty">טוען…</div>

  return (
    <div className="card">
      <div className="section-head">
        <h2>מלאי נוכחי</h2>
        <button className="ghost small" onClick={() =>
          downloadCsv('מלאי.csv', ['מוצר', 'מלאי', 'ביקוש שבועי', 'שבועות כיסוי', 'עלות נחיתה ליחידה'],
            rows.map((r) => [r.p.name, r.stock, r.weeklyDemand.toFixed(1), r.weeks?.toFixed(1) ?? '', r.landed?.toFixed(2) ?? '']))
        }>⬇ אקסל</button>
      </div>
      <table>
        <thead><tr><th>מוצר</th><th>במלאי</th><th>ביקוש שבועי</th><th>כיסוי</th><th>עלות נחיתה</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.p.id}>
              <td>{r.p.name}</td>
              <td className="num">{r.stock.toLocaleString('he-IL')} {r.p.unit}</td>
              <td className="num">{r.weeklyDemand > 0 ? `${r.weeklyDemand.toFixed(1)} ${r.p.unit}` : '—'}</td>
              <td>
                {r.weeks == null ? '—' :
                  r.weeks < 2 ? <span className="badge due">{r.weeks.toFixed(1)} שבועות</span> :
                  r.weeks < 4 ? <span className="badge soon">{r.weeks.toFixed(1)} שבועות</span> :
                  <span className="badge">{r.weeks.toFixed(1)} שבועות</span>}
              </td>
              <td className="num">{r.landed != null ? `${fmtMoney(r.landed)} / ${r.p.unit}` : '—'}</td>
              <td><button className="ghost small" onClick={() => setAdjusting(r.p)}>תיקון</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small-text muted" style={{ marginTop: 10 }}>
        המלאי מחושב אוטומטית: משלוחי ייבוא ששוחררו − אספקות ללקוחות + תיקונים ידניים.
        עלות נחיתה = סחורה + הובלה + מכס + עמילות, משוקלל לפי כמות.
      </div>
      {adjusting && (
        <AdjustForm product={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); load() }} />
      )}
    </div>
  )
}

function AdjustForm({ product, onClose, onSaved }) {
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault(); setErr('')
    const res = await supabase.from('stock_adjustments').insert({
      product_id: product.id, quantity: Number(qty), reason: reason || null,
    })
    if (res.error) return setErr(res.error.message)
    onSaved()
  }

  return (
    <Modal title={`תיקון מלאי — ${product.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <label>כמות (חיובי = הוספה, שלילי = הפחתה)</label>
        <input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} required />
        <label>סיבה (ספירת מלאי, פחת, פגום…)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button>שמירה</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Shipments ---------- */

function ShipmentsTab() {
  const [shipments, setShipments] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null)
  const [docsFor, setDocsFor] = useState(null)

  async function load() {
    const [s, sup, p] = await Promise.all([
      supabase.from('import_shipments').select('*, suppliers(name), import_items(id, product_id, quantity, unit_cost, currency, fx_rate, products(name, unit))').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('products').select('*').eq('active', true).order('name'),
    ])
    setShipments(s.data || [])
    setSuppliers(sup.data || [])
    setProducts(p.data || [])
  }
  useEffect(() => { load() }, [])

  async function setStatus(sh, status) {
    const patch = { status }
    if (status === 'released' && !sh.arrival_date) patch.arrival_date = new Date().toISOString().slice(0, 10)
    await supabase.from('import_shipments').update(patch).eq('id', sh.id)
    load()
  }

  const NEXT = { ordered: 'at_sea', at_sea: 'customs', customs: 'released' }

  return (
    <div className="card">
      <div className="section-head">
        <h2>משלוחי ייבוא</h2>
        <button className="small" onClick={() => setEditing({})}>+ משלוח ייבוא</button>
      </div>
      {shipments.length === 0 && <div className="empty">אין משלוחי ייבוא — הוסף את הקונטיינר הראשון</div>}
      {shipments.map((sh) => {
        const goods = (sh.import_items || []).reduce((t, it) => t + Number(it.quantity) * Number(it.unit_cost) * Number(it.fx_rate), 0)
        const extras = Number(sh.freight_cost) + Number(sh.customs_cost) + Number(sh.agent_cost) + Number(sh.inland_cost)
        return (
          <div key={sh.id} className="list-item">
            <div className="grow">
              <div className="title">
                {sh.reference || 'ללא מספר'} {sh.suppliers?.name ? `· ${sh.suppliers.name}` : ''}
              </div>
              <div className="sub">
                {(sh.import_items || []).map((it) => `${it.products?.name} ×${Number(it.quantity).toLocaleString('he-IL')}`).join(' · ') || 'ללא פריטים'}
              </div>
              <div className="sub num">
                סחורה {fmtMoney(goods)} + עלויות {fmtMoney(extras)} = <b>{fmtMoney(goods + extras)}</b>
                {sh.eta && sh.status !== 'released' ? ` · צפי הגעה ${fmtDate(sh.eta)}` : ''}
                {sh.arrival_date ? ` · הגיע ${fmtDate(sh.arrival_date)}` : ''}
              </div>
            </div>
            <span className={`badge ${sh.status === 'released' ? 'delivered' : 'planned'}`}>{SHIPMENT_STATUS[sh.status]}</span>
            {NEXT[sh.status] && (
              <button className="ghost small" onClick={() => setStatus(sh, NEXT[sh.status])}>
                → {SHIPMENT_STATUS[NEXT[sh.status]]}
              </button>
            )}
            <button className="ghost small" onClick={() => setDocsFor(sh)}>📎</button>
            <button className="ghost small" onClick={() => setEditing(sh)}>עריכה</button>
          </div>
        )
      })}
      {docsFor && <ShipmentDocs shipment={docsFor} onClose={() => setDocsFor(null)} />}
      {editing && (
        <ShipmentForm
          initial={editing.id ? editing : null}
          suppliers={suppliers}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function ShipmentForm({ initial, suppliers, products, onClose, onSaved }) {
  const [f, setF] = useState(initial ? {
    supplier_id: initial.supplier_id || '', reference: initial.reference || '',
    status: initial.status, departure_date: initial.departure_date || '', eta: initial.eta || '',
    freight_cost: initial.freight_cost, customs_cost: initial.customs_cost,
    agent_cost: initial.agent_cost, inland_cost: initial.inland_cost, notes: initial.notes || '',
  } : {
    supplier_id: '', reference: '', status: 'ordered', departure_date: '', eta: '',
    freight_cost: 0, customs_cost: 0, agent_cost: 0, inland_cost: 0, notes: '',
  })
  const [items, setItems] = useState(
    initial ? (initial.import_items || []).map((it) => ({
      id: it.id, product_id: it.product_id, quantity: it.quantity, unit_cost: it.unit_cost, currency: it.currency, fx_rate: it.fx_rate,
    })) : []
  )
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function addItem() {
    if (!products.length) return
    setItems([...items, { product_id: products[0].id, quantity: '', unit_cost: '', currency: 'USD', fx_rate: '' }])
  }

  async function save(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    const row = {
      supplier_id: f.supplier_id || null,
      reference: f.reference || null,
      status: f.status,
      departure_date: f.departure_date || null,
      eta: f.eta || null,
      freight_cost: Number(f.freight_cost) || 0,
      customs_cost: Number(f.customs_cost) || 0,
      agent_cost: Number(f.agent_cost) || 0,
      inland_cost: Number(f.inland_cost) || 0,
      notes: f.notes || null,
    }
    let shipmentId = initial?.id
    if (shipmentId) {
      const res = await supabase.from('import_shipments').update(row).eq('id', shipmentId)
      if (res.error) { setErr(res.error.message); setBusy(false); return }
      await supabase.from('import_items').delete().eq('shipment_id', shipmentId)
    } else {
      const res = await supabase.from('import_shipments').insert(row).select().single()
      if (res.error) { setErr(res.error.message); setBusy(false); return }
      shipmentId = res.data.id
    }
    const valid = items.filter((it) => it.product_id && Number(it.quantity) > 0)
    if (valid.length) {
      const res = await supabase.from('import_items').insert(valid.map((it) => ({
        shipment_id: shipmentId,
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost) || 0,
        currency: it.currency || 'USD',
        fx_rate: Number(it.fx_rate) || 1,
      })))
      if (res.error) { setErr(res.error.message); setBusy(false); return }
    }
    setBusy(false)
    onSaved()
  }

  return (
    <Modal title={initial ? 'עריכת משלוח ייבוא' : 'משלוח ייבוא חדש'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="formrow">
          <div>
            <label>ספק</label>
            <select value={f.supplier_id} onChange={set('supplier_id')}>
              <option value="">— ללא —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label>מספר / סימוכין (קונטיינר, BL…)</label><input value={f.reference} onChange={set('reference')} /></div>
        </div>
        <div className="formrow">
          <div>
            <label>סטטוס</label>
            <select value={f.status} onChange={set('status')}>
              {Object.entries(SHIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label>צפי הגעה (ETA)</label><input type="date" value={f.eta} onChange={set('eta')} /></div>
        </div>
        <label>תאריך יציאה</label>
        <input type="date" value={f.departure_date} onChange={set('departure_date')} />

        <div className="section-head" style={{ marginTop: 14 }}>
          <h3>פריטים</h3>
          <button type="button" className="ghost small" onClick={addItem}>+ פריט</button>
        </div>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={{ flex: '2 1 120px' }} value={it.product_id} onChange={(e) => { const n = items.slice(); n[i] = { ...it, product_id: e.target.value }; setItems(n) }}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input style={{ flex: '1 1 70px' }} type="number" step="0.01" min="0" placeholder="כמות" value={it.quantity} onChange={(e) => { const n = items.slice(); n[i] = { ...it, quantity: e.target.value }; setItems(n) }} />
            <input style={{ flex: '1 1 70px' }} type="number" step="0.0001" min="0" placeholder="מחיר ליח'" value={it.unit_cost} onChange={(e) => { const n = items.slice(); n[i] = { ...it, unit_cost: e.target.value }; setItems(n) }} />
            <select style={{ flex: '1 1 60px' }} value={it.currency} onChange={(e) => { const n = items.slice(); n[i] = { ...it, currency: e.target.value }; setItems(n) }}>
              <option>USD</option><option>EUR</option><option>ILS</option>
            </select>
            <input style={{ flex: '1 1 70px' }} type="number" step="0.0001" min="0" placeholder="שער ₪" value={it.fx_rate} onChange={(e) => { const n = items.slice(); n[i] = { ...it, fx_rate: e.target.value }; setItems(n) }} />
            <button type="button" className="ghost small" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {items.length > 0 && <div className="small-text muted">שער ₪ — כמה שקלים שווה יחידת מטבע (למטבע ILS הזן 1)</div>}

        <div className="section-head" style={{ marginTop: 14 }}><h3>עלויות נלוות (₪)</h3></div>
        <div className="formrow">
          <div><label>הובלה ימית</label><input type="number" step="0.01" min="0" value={f.freight_cost} onChange={set('freight_cost')} /></div>
          <div><label>מכס ומיסים</label><input type="number" step="0.01" min="0" value={f.customs_cost} onChange={set('customs_cost')} /></div>
        </div>
        <div className="formrow">
          <div><label>עמילות מכס</label><input type="number" step="0.01" min="0" value={f.agent_cost} onChange={set('agent_cost')} /></div>
          <div><label>הובלה יבשתית</label><input type="number" step="0.01" min="0" value={f.inland_cost} onChange={set('inland_cost')} /></div>
        </div>
        <label>הערות</label>
        <input value={f.notes} onChange={set('notes')} />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Shipment documents (BL, customs, supplier invoices) ---------- */

function ShipmentDocs({ shipment, onClose }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState('bl')
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.from('attachments').select('*').eq('shipment_id', shipment.id).order('created_at', { ascending: false })
    setFiles(data || [])
  }
  useEffect(() => { load() }, [shipment.id])

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    const path = `shipments/${shipment.id}/${Date.now()}-${file.name}`
    const up = await supabase.storage.from('attachments').upload(path, file)
    if (up.error) { setErr(up.error.message); setBusy(false); return }
    const ins = await supabase.from('attachments').insert({
      shipment_id: shipment.id, kind, title: file.name, file_path: path,
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
    <Modal title={`מסמכי משלוח ${shipment.reference || ''}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>סוג מסמך</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(IMPORT_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label className="btn" style={{ marginBottom: 0 }}>
          {busy ? 'מעלה…' : '📎 העלאת קובץ'}
          <input type="file" style={{ display: 'none' }} onChange={upload} disabled={busy} />
        </label>
      </div>
      {err && <div className="error">{err}</div>}
      <div style={{ marginTop: 12 }}>
        {files.length === 0 && <div className="empty">אין מסמכים למשלוח זה</div>}
        {files.map((f) => (
          <div key={f.id} className="list-item">
            <div className="grow">
              <div className="title">{f.title}</div>
              <div className="sub">{IMPORT_KIND_LABELS[f.kind] || f.kind} · {fmtDate(f.created_at)}</div>
            </div>
            <button className="ghost small" onClick={() => open(f)}>פתיחה</button>
            <button className="ghost small" onClick={() => del(f)}>🗑</button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ---------- Suppliers ---------- */

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([])
  const [editing, setEditing] = useState(null)

  async function load() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
  }
  useEffect(() => { load() }, [])

  return (
    <div className="card">
      <div className="section-head">
        <h2>ספקים</h2>
        <button className="small" onClick={() => setEditing({})}>+ ספק</button>
      </div>
      {suppliers.length === 0 && <div className="empty">אין ספקים</div>}
      {suppliers.map((s) => (
        <div key={s.id} className="list-item">
          <div className="grow">
            <div className="title">
              <Link to={`/suppliers/${s.id}`}>{s.name}</Link> {s.country ? `· ${s.country}` : ''}
              {s.supplier_code && <span className="muted small-text"> · #{s.supplier_code}</span>}
            </div>
            <div className="sub">
              {[s.contact_name, s.phone, s.currency, s.payment_terms].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="ghost small" onClick={() => setEditing(s)}>עריכה</button>
        </div>
      ))}
      {editing && (
        <SupplierForm initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}

export function SupplierForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', country: '', contact_name: '', phone: '', email: '', currency: 'USD', payment_terms: '', location: '', notes: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault(); setErr('')
    const row = { ...f }
    delete row.id; delete row.created_at
    // Leave supplier_code out of a brand-new insert when left blank, so the DB's
    // auto-numbering (supplier_code_seq) assigns it. Editing sends whatever is typed.
    if (!row.supplier_code) {
      if (initial) row.supplier_code = null
      else delete row.supplier_code
    }
    const res = initial
      ? await supabase.from('suppliers').update(row).eq('id', initial.id)
      : await supabase.from('suppliers').insert(row)
    if (res.error) return setErr(res.error.message)
    onSaved()
  }

  return (
    <Modal title={initial ? 'עריכת ספק' : 'ספק חדש'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="formrow">
          <div><label>שם הספק *</label><input value={f.name} onChange={set('name')} required /></div>
          <div>
            <label>מספר ספק</label>
            <input value={f.supplier_code || ''} onChange={set('supplier_code')} placeholder={initial ? '' : 'ריק = יוקצה מספר אוטומטי'} />
          </div>
        </div>
        <div className="formrow">
          <div><label>מדינה</label><input value={f.country || ''} onChange={set('country')} /></div>
          <div>
            <label>מטבע</label>
            <select value={f.currency} onChange={set('currency')}>
              <option>USD</option><option>EUR</option><option>ILS</option>
            </select>
          </div>
        </div>
        <div className="formrow">
          <div><label>איש קשר</label><input value={f.contact_name || ''} onChange={set('contact_name')} /></div>
          <div><label>טלפון</label><input dir="ltr" value={f.phone || ''} onChange={set('phone')} /></div>
        </div>
        <label>אימייל</label>
        <input dir="ltr" type="email" value={f.email || ''} onChange={set('email')} />
        <label>תנאי תשלום (מקדמה 30%, LC, שוטף…)</label>
        <input value={f.payment_terms || ''} onChange={set('payment_terms')} />
        <label>מיקום (כתובת או קישור מ-Google Maps)</label>
        <input value={f.location || ''} onChange={set('location')} placeholder="למשל: כתובת מלאה, או קישור ששיתפת מ-Google Maps" />
        <label>הערות</label>
        <textarea value={f.notes || ''} onChange={set('notes')} />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button>שמירה</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}
