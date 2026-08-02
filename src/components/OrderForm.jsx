import React, { useEffect, useState } from 'react'
import { supabase, fmtMoney } from '../supabase.js'
import Modal from './Modal.jsx'

// Order (delivery) creation form. Pre-fills prices from the customer's agreed prices.
export default function OrderForm({ customerId, customers, onClose, onSaved }) {
  const [custId, setCustId] = useState(customerId || '')
  const [products, setProducts] = useState([])
  const [agreed, setAgreed] = useState([])
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('products').select('*').eq('active', true).order('name')
      .then(({ data }) => setProducts(data || []))
  }, [])

  useEffect(() => {
    if (!custId) return setAgreed([])
    supabase.from('customer_products').select('*').eq('customer_id', custId)
      .then(({ data }) => setAgreed(data || []))
  }, [custId])

  function addItem() {
    const p = products[0]
    if (!p) return
    const ag = agreed.find((a) => a.product_id === p.id)
    setItems([...items, { product_id: p.id, quantity: '', unit_price: ag?.agreed_price ?? p.default_price ?? '' }])
  }

  function updateItem(i, k, v) {
    const next = items.slice()
    next[i] = { ...next[i], [k]: v }
    if (k === 'product_id') {
      const ag = agreed.find((a) => a.product_id === v)
      const p = products.find((x) => x.id === v)
      next[i].unit_price = ag?.agreed_price ?? p?.default_price ?? ''
    }
    setItems(next)
  }

  const total = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)

  async function save(e) {
    e.preventDefault(); setErr('')
    if (!custId) return setErr('בחר לקוח')
    setBusy(true)
    const { data: order, error } = await supabase.from('orders')
      .insert({ customer_id: custId, delivery_date: deliveryDate, notes: notes || null })
      .select().single()
    if (error) { setErr(error.message); setBusy(false); return }
    const valid = items.filter((it) => it.product_id && Number(it.quantity) > 0)
    if (valid.length) {
      const { error: e2 } = await supabase.from('order_items').insert(
        valid.map((it) => ({
          order_id: order.id,
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price) || 0,
        }))
      )
      if (e2) { setErr(e2.message); setBusy(false); return }
    }
    setBusy(false)
    onSaved()
  }

  return (
    <Modal title="משלוח חדש" onClose={onClose}>
      <form onSubmit={save}>
        {customers && (
          <>
            <label>לקוח *</label>
            <select value={custId} onChange={(e) => setCustId(e.target.value)} required>
              <option value="">בחר לקוח…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}
        <label>תאריך אספקה</label>
        <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required />

        <div className="section-head" style={{ marginTop: 14 }}>
          <h3>פריטים</h3>
          <button type="button" className="ghost small" onClick={addItem}>+ פריט</button>
        </div>
        {items.map((it, i) => {
          const p = products.find((x) => x.id === it.product_id)
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select style={{ flex: 2 }} value={it.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)}>
                {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </select>
              <input style={{ flex: 1 }} type="number" step="0.01" min="0" placeholder={`כמות${p?.unit ? ` (${p.unit})` : ''}`}
                value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
              <input style={{ flex: 1 }} type="number" step="0.01" min="0" placeholder="מחיר"
                value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
              <button type="button" className="ghost small" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
            </div>
          )
        })}
        {items.length > 0 && <div className="small-text num"><b>סה״כ: {fmtMoney(total)}</b></div>}

        <label>הערות</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}
