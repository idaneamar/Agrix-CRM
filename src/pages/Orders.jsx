import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, fmtMoney, fmtDate, ORDER_STATUS_LABELS } from '../supabase.js'
import { daysUntil } from '../nextDelivery.js'
import OrderForm from '../components/OrderForm.jsx'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [filter, setFilter] = useState('planned')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [o, c] = await Promise.all([
      supabase.from('orders')
        .select('*, customers(name), order_items(quantity, unit_price, products(name, unit))')
        .order('delivery_date', { ascending: filter === 'planned', nullsFirst: false }),
      supabase.from('customers').select('id, name').order('name'),
    ])
    setOrders(o.data || [])
    setCustomers(c.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  async function setStatus(o, status) {
    await supabase.from('orders').update({ status }).eq('id', o.id)
    load()
  }

  const filtered = orders.filter((o) => (filter === 'all' ? true : o.status === filter))

  return (
    <div>
      <div className="section-head">
        <h1>משלוחים</h1>
        <button onClick={() => setAdding(true)}>+ משלוח חדש</button>
      </div>
      <div className="tabs">
        {[['planned', 'מתוכננים'], ['delivered', 'סופקו'], ['all', 'הכל']].map(([k, v]) => (
          <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{v}</button>
        ))}
      </div>
      <div className="card">
        {loading && <div className="empty">טוען…</div>}
        {!loading && filtered.length === 0 && <div className="empty">אין משלוחים להצגה</div>}
        {filtered.map((o) => {
          const total = (o.order_items || []).reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0)
          const d = o.delivery_date ? daysUntil(o.delivery_date) : null
          return (
            <div key={o.id} className="list-item">
              <div className="grow">
                <div className="title">
                  <Link to={`/customers/${o.customer_id}`}>{o.customers?.name}</Link>
                </div>
                <div className="sub">
                  {fmtDate(o.delivery_date)} · <span className="num">{fmtMoney(total)}</span>
                  {(o.order_items || []).length > 0 && ' · ' + o.order_items.map((it) => `${it.products?.name} ×${it.quantity}`).join(', ')}
                </div>
              </div>
              {o.status === 'planned' && d != null && d < 0 && <span className="badge due">באיחור</span>}
              {o.status === 'planned' && d != null && d >= 0 && d <= 2 && <span className="badge soon">{d === 0 ? 'היום' : `בעוד ${d} ימים`}</span>}
              <span className={`badge ${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span>
              {o.status === 'planned' && (
                <>
                  <button className="ghost small" onClick={() => setStatus(o, 'delivered')}>סופק ✓</button>
                  <button className="ghost small" onClick={() => setStatus(o, 'canceled')}>ביטול</button>
                </>
              )}
            </div>
          )
        })}
      </div>
      {adding && (
        <OrderForm customers={customers} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}
    </div>
  )
}
