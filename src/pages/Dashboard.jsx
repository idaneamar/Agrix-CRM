import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import { supabase, fmtMoney, fmtDate } from '../supabase.js'
import { nextDeliveryFor, daysUntil } from '../nextDelivery.js'

const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

export default function Dashboard() {
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('order_items').select('*, orders(delivery_date, status)'),
      supabase.from('products').select('*'),
    ]).then(([c, o, i, p]) => {
      setCustomers(c.data || [])
      setOrders(o.data || [])
      setItems(i.data || [])
      setProducts(p.data || [])
      setLoading(false)
    })
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const monthKey = now.toISOString().slice(0, 7)
    const active = customers.filter((c) => c.status === 'active').length
    const deliveredItems = items.filter((it) => it.orders?.status === 'delivered')
    const monthRevenue = deliveredItems
      .filter((it) => (it.orders?.delivery_date || '').startsWith(monthKey))
      .reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0)
    const plannedCount = orders.filter((o) => o.status === 'planned').length
    const weekAhead = new Date(now); weekAhead.setDate(now.getDate() + 7)
    const plannedThisWeek = orders.filter(
      (o) => o.status === 'planned' && o.delivery_date &&
        new Date(o.delivery_date) <= weekAhead
    ).length
    return { active, monthRevenue, plannedCount, plannedThisWeek }
  }, [customers, orders, items])

  // Revenue by month — last 6 months, delivered orders only
  const revenueByMonth = useMemo(() => {
    const map = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      map[d.toISOString().slice(0, 7)] = 0
    }
    items.forEach((it) => {
      if (it.orders?.status !== 'delivered' || !it.orders?.delivery_date) return
      const k = it.orders.delivery_date.slice(0, 7)
      if (k in map) map[k] += Number(it.quantity) * Number(it.unit_price)
    })
    return Object.entries(map).map(([k, v]) => ({
      month: new Date(k + '-01').toLocaleDateString('he-IL', { month: 'short' }),
      revenue: Math.round(v),
    }))
  }, [items])

  // Quantity per product (delivered, all time)
  const qtyByProduct = useMemo(() => {
    const map = {}
    items.forEach((it) => {
      if (it.orders?.status !== 'delivered') return
      map[it.product_id] = (map[it.product_id] || 0) + Number(it.quantity)
    })
    return Object.entries(map)
      .map(([pid, qty]) => ({
        name: products.find((p) => p.id === pid)?.name || '?',
        qty: Math.round(qty * 100) / 100,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
  }, [items, products])

  // Upcoming deliveries per customer
  const upcoming = useMemo(() =>
    customers
      .filter((c) => c.status === 'active')
      .map((c) => ({ c, next: nextDeliveryFor(c, orders) }))
      .filter((x) => x.next)
      .sort((a, b) => a.next.date.localeCompare(b.next.date))
      .slice(0, 8),
  [customers, orders])

  if (loading) return <div className="empty">טוען נתונים…</div>

  return (
    <div>
      <h1>לוח בקרה</h1>
      <div className="grid4">
        <div className="card tile"><div className="val num">{stats.active}</div><div className="lbl">לקוחות פעילים</div></div>
        <div className="card tile"><div className="val num">{fmtMoney(stats.monthRevenue)}</div><div className="lbl">הכנסות החודש</div></div>
        <div className="card tile"><div className="val num">{stats.plannedThisWeek}</div><div className="lbl">משלוחים בשבוע הקרוב</div></div>
        <div className="card tile"><div className="val num">{stats.plannedCount}</div><div className="lbl">משלוחים מתוכננים</div></div>
      </div>

      <div className="card">
        <div className="section-head">
          <h2>משלוחים קרובים</h2>
          <Link to="/orders" className="small-text">לכל המשלוחים ←</Link>
        </div>
        {upcoming.length === 0 && <div className="empty">אין משלוחים קרובים — הוסף לקוחות ומשלוחים כדי לראות תחזית</div>}
        {upcoming.map(({ c, next }) => {
          const d = daysUntil(next.date)
          return (
            <Link key={c.id} to={`/customers/${c.id}`} className="list-item">
              <div className="grow">
                <div className="title">{c.name}</div>
                <div className="sub">
                  {fmtDate(next.date)} · {next.source === 'planned' ? 'מתוכנן' : 'הערכה לפי תדירות'}
                </div>
              </div>
              {d < 0 && <span className="badge due">באיחור {-d} ימים</span>}
              {d >= 0 && d <= 2 && <span className="badge soon">{d === 0 ? 'היום' : `בעוד ${d} ימים`}</span>}
              {d > 2 && <span className="badge">{`בעוד ${d} ימים`}</span>}
            </Link>
          )
        })}
      </div>

      <div className="grid2">
        <div className="card chart-card">
          <div className="chart-title">הכנסות לפי חודש (₪)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByMonth} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="month" axisLine={{ stroke: 'var(--baseline)' }} tickLine={false} />
              <YAxis width={54} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString('he-IL')} />
              <Tooltip
                formatter={(v) => [fmtMoney(v), 'הכנסות']}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)' }}
              />
              <Bar dataKey="revenue" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <div className="chart-title">כמות שסופקה לפי מוצר</div>
          {qtyByProduct.length === 0 ? (
            <div className="empty">עדיין אין אספקות</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={qtyByProduct} layout="vertical" margin={{ top: 8, left: 0, right: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" horizontal={false} />
                <XAxis type="number" axisLine={{ stroke: 'var(--baseline)' }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={80} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [v.toLocaleString('he-IL'), 'כמות']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)' }}
                />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {qtyByProduct.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
