import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, fmtMoney, fmtDate } from '../supabase.js'
import { PAY_METHODS, balanceByCustomer, landedCosts, downloadCsv } from '../logic.js'
import Modal from '../components/Modal.jsx'

export default function Finance() {
  const [tab, setTab] = useState('debts')
  return (
    <div>
      <h1>כספים</h1>
      <div className="tabs">
        {[['debts', 'חובות וגבייה'], ['profit', 'רווחיות'], ['payments', 'תשלומים אחרונים']].map(([k, v]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>
      {tab === 'debts' && <DebtsTab />}
      {tab === 'profit' && <ProfitTab />}
      {tab === 'payments' && <PaymentsTab />}
    </div>
  )
}

/* ---------- Debts ---------- */

function DebtsTab() {
  const [customers, setCustomers] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [payments, setPayments] = useState([])
  const [paying, setPaying] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [c, oi, p] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('order_items').select('quantity, unit_price, orders(status, customer_id)'),
      supabase.from('payments').select('*'),
    ])
    setCustomers(c.data || [])
    setOrderItems(oi.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    const bal = balanceByCustomer(orderItems, payments)
    return customers
      .map((c) => ({ c, balance: bal[c.id] || 0 }))
      .filter((r) => Math.abs(r.balance) > 0.005 || r.c.status === 'active')
      .sort((a, b) => b.balance - a.balance)
  }, [customers, orderItems, payments])

  const totalDebt = rows.reduce((t, r) => t + Math.max(0, r.balance), 0)

  if (loading) return <div className="empty">טוען…</div>

  return (
    <div className="card">
      <div className="section-head">
        <h2>יתרות לקוחות <span className="muted small-text">(סה״כ חוב פתוח: <b className="num">{fmtMoney(totalDebt)}</b>)</span></h2>
        <button className="ghost small" onClick={() =>
          downloadCsv('חובות.csv', ['לקוח', 'תנאי תשלום', 'יתרה'],
            rows.map((r) => [r.c.name, r.c.payment_terms || '', r.balance.toFixed(2)]))
        }>⬇ אקסל</button>
      </div>
      {rows.length === 0 && <div className="empty">אין נתונים עדיין</div>}
      {rows.map(({ c, balance }) => (
        <div key={c.id} className="list-item">
          <div className="grow">
            <div className="title"><Link to={`/customers/${c.id}`}>{c.name}</Link></div>
            <div className="sub">{c.payment_terms ? `תנאי תשלום: ${c.payment_terms}` : 'ללא תנאי תשלום מוגדרים'}</div>
          </div>
          <span className={balance > 0.005 ? 'badge due' : 'badge delivered'}>
            <span className="num">{fmtMoney(balance)}</span>
          </span>
          <button className="ghost small" onClick={() => setPaying(c)}>+ תשלום</button>
        </div>
      ))}
      <div className="small-text muted" style={{ marginTop: 10 }}>
        היתרה מחושבת: סך אספקות שסומנו "סופק" פחות תשלומים שנרשמו. יתרה חיובית = הלקוח חייב לך.
      </div>
      {paying && (
        <PaymentForm customer={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load() }} />
      )}
    </div>
  )
}

function PaymentForm({ customer, onClose, onSaved }) {
  const [f, setF] = useState({ amount: '', paid_at: new Date().toISOString().slice(0, 10), method: 'transfer', notes: '' })
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault(); setErr('')
    const res = await supabase.from('payments').insert({
      customer_id: customer.id, amount: Number(f.amount),
      paid_at: f.paid_at, method: f.method, notes: f.notes || null,
    })
    if (res.error) return setErr(res.error.message)
    onSaved()
  }

  return (
    <Modal title={`רישום תשלום — ${customer.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <div className="formrow">
          <div><label>סכום (₪) *</label><input type="number" step="0.01" min="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
          <div><label>תאריך</label><input type="date" value={f.paid_at} onChange={(e) => setF({ ...f, paid_at: e.target.value })} /></div>
        </div>
        <label>אמצעי תשלום</label>
        <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          {Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label>הערות (מס' אסמכתא…)</label>
        <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button>שמירה</button>
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Profitability ---------- */

function ProfitTab() {
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*'),
      supabase.from('customers').select('id, name'),
      supabase.from('order_items').select('product_id, quantity, unit_price, orders(status, customer_id)'),
      supabase.from('import_shipments').select('*'),
      supabase.from('import_items').select('*'),
    ]).then(([p, c, oi, sh, ii]) => setData({
      products: p.data || [], customers: c.data || [],
      orderItems: (oi.data || []).filter((it) => it.orders?.status === 'delivered'),
      shipments: sh.data || [], importItems: ii.data || [],
    }))
  }, [])

  const calc = useMemo(() => {
    if (!data) return null
    const landed = landedCosts(data.shipments, data.importItems)
    const byProduct = {}
    const byCustomer = {}
    let missingCost = false
    data.orderItems.forEach((it) => {
      const qty = Number(it.quantity)
      const revenue = qty * Number(it.unit_price)
      const unitCost = landed[it.product_id]
      const cost = unitCost != null ? qty * unitCost : null
      if (cost == null) missingCost = true
      const p = (byProduct[it.product_id] ||= { qty: 0, revenue: 0, cost: 0, costKnown: true })
      p.qty += qty; p.revenue += revenue
      if (cost == null) p.costKnown = false; else p.cost += cost
      const cid = it.orders.customer_id
      const cu = (byCustomer[cid] ||= { revenue: 0, cost: 0, costKnown: true })
      cu.revenue += revenue
      if (cost == null) cu.costKnown = false; else cu.cost += cost
    })
    return { landed, byProduct, byCustomer, missingCost }
  }, [data])

  if (!data || !calc) return <div className="empty">טוען…</div>

  const productRows = Object.entries(calc.byProduct).map(([pid, v]) => ({
    name: data.products.find((p) => p.id === pid)?.name || '?', ...v,
    profit: v.costKnown ? v.revenue - v.cost : null,
    margin: v.costKnown && v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : null,
  })).sort((a, b) => (b.profit ?? -1e18) - (a.profit ?? -1e18))

  const customerRows = Object.entries(calc.byCustomer).map(([cid, v]) => ({
    id: cid,
    name: data.customers.find((c) => c.id === cid)?.name || '?', ...v,
    profit: v.costKnown ? v.revenue - v.cost : null,
  })).sort((a, b) => (b.profit ?? -1e18) - (a.profit ?? -1e18))

  return (
    <>
      <div className="card">
        <div className="section-head">
          <h2>רווחיות לפי מוצר</h2>
          <button className="ghost small" onClick={() =>
            downloadCsv('רווחיות-מוצרים.csv', ['מוצר', 'כמות', 'הכנסות', 'עלות', 'רווח', 'שולי רווח %'],
              productRows.map((r) => [r.name, r.qty, r.revenue.toFixed(2), r.costKnown ? r.cost.toFixed(2) : '', r.profit?.toFixed(2) ?? '', r.margin?.toFixed(1) ?? '']))
          }>⬇ אקסל</button>
        </div>
        {productRows.length === 0 && <div className="empty">אין עדיין אספקות שסומנו "סופק"</div>}
        {productRows.length > 0 && (
          <table>
            <thead><tr><th>מוצר</th><th>הכנסות</th><th>עלות</th><th>רווח</th><th>שוליים</th></tr></thead>
            <tbody>
              {productRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">{fmtMoney(r.revenue)}</td>
                  <td className="num">{r.costKnown ? fmtMoney(r.cost) : '—'}</td>
                  <td className="num" style={{ color: r.profit == null ? undefined : r.profit >= 0 ? 'var(--good-text)' : 'var(--critical)' }}>
                    {r.profit != null ? fmtMoney(r.profit) : '—'}
                  </td>
                  <td className="num">{r.margin != null ? `${r.margin.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {calc.missingCost && (
          <div className="small-text muted" style={{ marginTop: 8 }}>
            ⚠ לחלק מהמוצרים אין עדיין עלות נחיתה (נדרש משלוח ייבוא בסטטוס "שוחרר") — הרווח עבורם לא מחושב.
          </div>
        )}
      </div>

      <div className="card">
        <h2>רווחיות לפי לקוח</h2>
        {customerRows.length === 0 && <div className="empty">אין נתונים</div>}
        {customerRows.length > 0 && (
          <table>
            <thead><tr><th>לקוח</th><th>הכנסות</th><th>רווח</th></tr></thead>
            <tbody>
              {customerRows.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/customers/${r.id}`}>{r.name}</Link></td>
                  <td className="num">{fmtMoney(r.revenue)}</td>
                  <td className="num" style={{ color: r.profit == null ? undefined : r.profit >= 0 ? 'var(--good-text)' : 'var(--critical)' }}>
                    {r.profit != null ? fmtMoney(r.profit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

/* ---------- Recent payments ---------- */

function PaymentsTab() {
  const [payments, setPayments] = useState([])

  async function load() {
    const { data } = await supabase.from('payments').select('*, customers(name)').order('paid_at', { ascending: false }).limit(100)
    setPayments(data || [])
  }
  useEffect(() => { load() }, [])

  async function del(p) {
    await supabase.from('payments').delete().eq('id', p.id)
    load()
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>תשלומים אחרונים</h2>
        <button className="ghost small" onClick={() =>
          downloadCsv('תשלומים.csv', ['תאריך', 'לקוח', 'סכום', 'אמצעי', 'הערות'],
            payments.map((p) => [p.paid_at, p.customers?.name || '', Number(p.amount).toFixed(2), PAY_METHODS[p.method], p.notes || '']))
        }>⬇ אקסל</button>
      </div>
      {payments.length === 0 && <div className="empty">אין תשלומים רשומים</div>}
      {payments.map((p) => (
        <div key={p.id} className="list-item">
          <div className="grow">
            <div className="title">{p.customers?.name} · <span className="num">{fmtMoney(p.amount)}</span></div>
            <div className="sub">{fmtDate(p.paid_at)} · {PAY_METHODS[p.method]}{p.notes ? ` · ${p.notes}` : ''}</div>
          </div>
          <button className="ghost small" onClick={() => del(p)}>🗑</button>
        </div>
      ))}
    </div>
  )
}
