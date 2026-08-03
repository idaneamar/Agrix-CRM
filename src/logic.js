// Shared business logic: stock, landed cost, profitability, balances, CSV export.

export const SHIPMENT_STATUS = {
  ordered: 'הוזמן',
  at_sea: 'בים',
  customs: 'במכס',
  released: 'שוחרר',
  canceled: 'בוטל',
}

export const PAY_METHODS = {
  cash: 'מזומן',
  transfer: 'העברה בנקאית',
  check: "צ'ק",
  credit: 'אשראי',
  other: 'אחר',
}

// Landed cost per product (ILS per unit), weighted average over released shipments.
// Shipment-level costs (freight/customs/agent/inland, in ILS) are allocated by quantity share.
export function landedCosts(shipments, importItems) {
  const perProduct = {} // product_id -> { qty, cost }
  shipments
    .filter((s) => s.status === 'released')
    .forEach((s) => {
      const items = importItems.filter((it) => it.shipment_id === s.id)
      const totalQty = items.reduce((t, it) => t + Number(it.quantity), 0)
      const extras = Number(s.freight_cost) + Number(s.customs_cost) + Number(s.agent_cost) + Number(s.inland_cost)
      items.forEach((it) => {
        const qty = Number(it.quantity)
        const goods = qty * Number(it.unit_cost) * Number(it.fx_rate)
        const alloc = totalQty > 0 ? extras * (qty / totalQty) : 0
        const p = (perProduct[it.product_id] ||= { qty: 0, cost: 0 })
        p.qty += qty
        p.cost += goods + alloc
      })
    })
  const out = {}
  for (const [pid, { qty, cost }] of Object.entries(perProduct)) {
    out[pid] = qty > 0 ? cost / qty : null
  }
  return out // product_id -> ILS per unit (or missing)
}

// Current stock per product: released imports − delivered sales + adjustments.
export function stockByProduct(importItems, shipments, orderItems, adjustments) {
  const released = new Set(shipments.filter((s) => s.status === 'released').map((s) => s.id))
  const stock = {}
  importItems.forEach((it) => {
    if (released.has(it.shipment_id)) stock[it.product_id] = (stock[it.product_id] || 0) + Number(it.quantity)
  })
  orderItems.forEach((it) => {
    if (it.orders?.status === 'delivered') stock[it.product_id] = (stock[it.product_id] || 0) - Number(it.quantity)
  })
  adjustments.forEach((a) => {
    stock[a.product_id] = (stock[a.product_id] || 0) + Number(a.quantity)
  })
  return stock
}

// Expected weekly demand per product from customer agreements.
export function weeklyDemandByProduct(customerProducts, customers) {
  const activeIds = new Set(customers.filter((c) => c.status === 'active').map((c) => c.id))
  const demand = {}
  customerProducts.forEach((cp) => {
    if (!activeIds.has(cp.customer_id) || !cp.quantity) return
    const weekly = cp.quantity_period === 'weekly' ? Number(cp.quantity) : Number(cp.quantity) / 4.33
    demand[cp.product_id] = (demand[cp.product_id] || 0) + weekly
  })
  return demand
}

// Customer balance: delivered order totals − payments. Positive = owes us.
export function balanceByCustomer(orderItems, payments) {
  const bal = {}
  orderItems.forEach((it) => {
    if (it.orders?.status !== 'delivered') return
    const cid = it.orders.customer_id
    bal[cid] = (bal[cid] || 0) + Number(it.quantity) * Number(it.unit_price)
  })
  payments.forEach((p) => {
    bal[p.customer_id] = (bal[p.customer_id] || 0) - Number(p.amount)
  })
  return bal
}

// CSV download with BOM so Hebrew opens correctly in Excel.
export function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Link helpers
export function waLink(phone) {
  if (!phone) return null
  let p = phone.replace(/[^\d+]/g, '')
  if (p.startsWith('0')) p = '+972' + p.slice(1)
  return `https://wa.me/${p.replace('+', '')}`
}

export function wazeLink(customer) {
  const addr = [customer.street, customer.city].filter(Boolean).join(', ')
  if (!addr) return null
  return `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`
}
